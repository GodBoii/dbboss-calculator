import pandas as pd
import json
import os
import glob
from datetime import datetime
from collections import Counter

class AdvancedPredictor:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.df = self.load_latest_data()
        
        # Categorize markets by assumed volume (Liquidity)
        self.high_volume = ['Kalyan', 'Main Bombay', 'Milan Day', 'Milan Night', 'Kalyan Morning']
        self.medium_volume = ['Rajdhani Day', 'Rajdhani Night', 'Time Bazar', 'Madhur Day', 'Madhur Morning']
        
        # Liquidity-Based Correlation (Chronological Flow)
        # Target Market (Where they chase) -> Source Market (Where they won/lost earlier)
        self.liquidity_flow_map = {
            'Kalyan': 'Milan Day',           # Afternoon liquidity flows into Evening Anchor
            'Main Bombay': 'Kalyan',         # Evening liquidity flows into Night Anchor
            'Milan Night': 'Rajdhani Day',   # Day games flow into Night games
            'Rajdhani Night': 'Milan Day', 
            'Time Bazar': 'Kalyan Morning',
            'Madhur Day': 'Madhur Morning',
            'Supreme Night': 'Supreme Day'
        }
        
        self.lucky_digits = ['7', '8', '9']
        self.all_panels = self.generate_all_panels()
        
    def generate_all_panels(self):
        panels = []
        ordered_digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
        for i in range(10):
            for j in range(i, 10):
                for k in range(j, 10):
                    panels.append(f"{ordered_digits[i]}{ordered_digits[j]}{ordered_digits[k]}")
        return panels

    def load_latest_data(self) -> pd.DataFrame:
        csv_files = glob.glob(f"{self.data_dir}/panel_data_*.csv")
        if not csv_files:
            print("[X] No data files found for prediction!")
            return pd.DataFrame()
        latest_file = max(csv_files, key=os.path.getctime)
        print(f"[DIR] Loading data for prediction from: {latest_file}")
        return pd.read_csv(latest_file)

    def is_sequential(self, panel):
        if len(panel) != 3: return False
        try:
            d1, d2, d3 = int(panel[0]), int(panel[1]), int(panel[2])
            if d2 == d1 + 1 and d3 == d2 + 1: return True
            if d2 == d1 - 1 and d3 == d2 - 1: return True
            if panel in ['890', '901', '012', '789']: return True
        except:
            pass
        return False

    def is_triple(self, panel):
        return panel[0] == panel[1] == panel[2] if len(panel) == 3 else False

    def count_lucky_digits(self, panel):
        return sum(1 for d in str(panel) if d in self.lucky_digits)
    
    def calculate_sutta(self, panel):
        try:
            return sum(int(d) for d in str(panel)) % 10
        except:
            return 0

    def analyze_market(self, market_name):
        market_df = self.df[self.df['market'] == market_name].copy()
        if market_df.empty:
            return None
            
        # 1. Market Volume Variance Weighting
        if market_name in self.high_volume:
            vol_multiplier = 0.6  # Can afford some winners
        elif market_name in self.medium_volume:
            vol_multiplier = 0.8
        else:
            vol_multiplier = 1.0  # Predatory, strict adherence to low liability
            
        # 2. Temporal Cycle Tracking (Payday Effect)
        current_day = datetime.now().day
        if 1 <= current_day <= 5:
            # Payday - public has money, house is predatory
            temporal_multiplier = 1.2
        elif 25 <= current_day <= 31:
            # Broke - house becomes generous to keep players hooked
            temporal_multiplier = 0.7
        else:
            temporal_multiplier = 1.0
            
        # 3. Honey-Pot Detection
        # Check how many days since last sequential or triple
        market_df['is_seq'] = market_df['panel'].apply(lambda x: self.is_sequential(str(x)))
        seq_records = market_df[market_df['is_seq'] == True]
        
        # Approximate "days since" by looking at record count (assuming 1 record ~ 1 day)
        records_since_seq = len(market_df)
        if not seq_records.empty:
            # Taking the index difference from the most recent (assuming tail is latest)
            records_since_seq = len(market_df) - seq_records.index[-1]
            
        # If > 40 days without a sequence, they might spring a honey-pot
        honey_pot_active = records_since_seq > 40

        # Calculate Sutta Saturation (Droughts)
        # Find how many records ago each sutta (0-9) was last seen
        sutta_droughts = {str(i): 1000 for i in range(10)} # Default high drought
        for idx in range(len(market_df)-1, -1, -1):
            row_panel = market_df.iloc[idx]['panel']
            row_sutta = str(self.calculate_sutta(row_panel))
            drought = (len(market_df) - 1) - idx
            if sutta_droughts[row_sutta] == 1000: # Not found yet
                sutta_droughts[row_sutta] = drought
                
        # Suttas that haven't appeared in > 8 draws are considered "Saturated" (Public thinks they are 'due', so operator avoids them)
        saturated_suttas = [s for s, d in sutta_droughts.items() if d > 8]

        # 4. Liquidity-Based Correlation (Chronological Spillover)
        liquidity_multiplier = 1.0
        source_market_name = self.liquidity_flow_map.get(market_name)
        if source_market_name:
            source_df = self.df[self.df['market'] == source_market_name]
            if not source_df.empty:
                last_source_panel = str(source_df.iloc[-1]['panel'])
                if self.is_sequential(last_source_panel) or self.is_triple(last_source_panel):
                    # Source market dropped a popular pattern. Public won big and will chase it here. 
                    # House will brutally penalize popular numbers in this current market.
                    liquidity_multiplier = 1.5
                else:
                    # Source market dropped a random hard number. Public is scared.
                    liquidity_multiplier = 0.9

        # Calculate historical frequencies for this specific market
        freq_counts = Counter(market_df['panel'].dropna().astype(str))
        max_freq = max(freq_counts.values()) if freq_counts else 1

        predictions = []
        for panel in self.all_panels:
            freq = freq_counts.get(panel, 0)
            
            # Base logic
            freq_score = 100 if freq == 0 else max(0, 100 - (freq / max_freq) * 100)
            
            seq_penalty = 0
            if self.is_sequential(panel):
                seq_penalty = 40 * (vol_multiplier * temporal_multiplier * liquidity_multiplier)
                if honey_pot_active:
                    # Invert the penalty! The trap is set.
                    seq_penalty = -50 
                    
            lucky_penalty = self.count_lucky_digits(panel) * 15 * (vol_multiplier * temporal_multiplier * liquidity_multiplier)
            
            triple_penalty = 0
            if self.is_triple(panel):
                triple_penalty = 50 * (vol_multiplier * temporal_multiplier * liquidity_multiplier)
                
            # Sutta Saturation Penalty
            panel_sutta = str(self.calculate_sutta(panel))
            saturation_penalty = 30 if panel_sutta in saturated_suttas else 0
                
            raw_score = (freq_score * 0.40) - (seq_penalty * 0.20) - (lucky_penalty * 0.15) - (triple_penalty * 0.15) - saturation_penalty
            final_score = max(0, min(100, raw_score + 20)) # Normalize slightly up
            
            predictions.append({
                'panel': panel,
                'sutta': panel_sutta,
                'score': round(final_score, 2),
                'is_honey_pot_pick': bool(honey_pot_active and self.is_sequential(panel)),
                'breakdown': {
                    'base_freq_score': round(freq_score * 0.40, 2),
                    'seq_penalty': round(seq_penalty * 0.20, 2),
                    'lucky_penalty': round(lucky_penalty * 0.15, 2),
                    'triple_penalty': round(triple_penalty * 0.15, 2),
                    'saturation_penalty': saturation_penalty
                }
            })
            
        # Sort by score descending
        predictions.sort(key=lambda x: x['score'], reverse=True)
        
        return {
            'market': market_name,
            'volume_tier': 'High' if market_name in self.high_volume else ('Medium' if market_name in self.medium_volume else 'Low'),
            'temporal_multiplier': float(temporal_multiplier),
            'liquidity_multiplier': float(liquidity_multiplier),
            'honey_pot_alert': bool(honey_pot_active),
            'sutta_droughts': sutta_droughts,
            'saturated_suttas': saturated_suttas,
            'top_picks': predictions
        }

    def generate_all_predictions(self):
        if self.df.empty: return
        
        print("\n" + "="*60)
        print("[*] RUNNING GAME-THEORY PREDICTION ENGINE")
        print("="*60)
        
        markets = self.df['market'].unique()
        all_reports = []
        
        for market in markets:
            report = self.analyze_market(market)
            if report:
                all_reports.append(report)
                
        # Save to JSON for the frontend calculator to consume
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        json_output = f"{self.data_dir}/advanced_predictions_{timestamp}.json"
        with open(json_output, 'w') as f:
            json.dump(all_reports, f, indent=2)
            
        # Also save as a JS file so the HTML can easily load it locally without a web server
        js_output = f"{self.data_dir}/advanced_data.js"
        with open(js_output, 'w') as f:
            f.write(f"window.ADVANCED_PREDICTIONS = {json.dumps(all_reports, indent=2)};")
            
        print(f"[OK] Advanced predictions saved to {json_output}")
        print(f"[OK] UI Data saved to {js_output}")
        
        # Print a quick summary of interesting findings
        honey_pots = [r['market'] for r in all_reports if r['honey_pot_alert']]
        if honey_pots:
            print("\n[!] HONEY-POT ALERTS (High probability of sequential traps today):")
            for m in honey_pots:
                print(f"   - {m}")
                
        print("\n[Target] Top 3 Markets & Best Picks:")
        for r in all_reports[:3]:
            picks = [p['panel'] for p in r['top_picks'][:3]]
            print(f"   {r['market']}: {', '.join(picks)}")
            
        return json_output

if __name__ == "__main__":
    predictor = AdvancedPredictor()
    predictor.generate_all_predictions()
