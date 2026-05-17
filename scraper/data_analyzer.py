"""
Matka Data Analyzer
Analyzes scraped data to find patterns and insights
"""

import pandas as pd
import json
from collections import Counter
from typing import Dict, List, Tuple
import glob
import os

class MatkaDataAnalyzer:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.panel_data = None
        
    def load_latest_data(self) -> pd.DataFrame:
        """Load the most recent scraped data"""
        csv_files = glob.glob(f"{self.data_dir}/panel_data_*.csv")
        
        if not csv_files:
            print("❌ No data files found!")
            return pd.DataFrame()
        
        # Get the most recent file
        latest_file = max(csv_files, key=os.path.getctime)
        print(f"📂 Loading data from: {latest_file}")
        
        self.panel_data = pd.read_csv(latest_file)
        print(f"✅ Loaded {len(self.panel_data)} records")
        
        return self.panel_data
    
    def analyze_frequency(self, market: str = None) -> Dict:
        """Analyze frequency of panels, suttas, and digits"""
        df = self.panel_data
        
        if market:
            df = df[df['market'] == market]
        
        if df.empty:
            return {}
        
        analysis = {
            'total_records': len(df),
            'panel_frequency': Counter(df['panel'].dropna()).most_common(20),
            'sutta_frequency': Counter(df['calculated_sutta'].dropna()).most_common(),
            'digit1_frequency': Counter(df['digit1'].dropna()).most_common(),
            'digit2_frequency': Counter(df['digit2'].dropna()).most_common(),
            'digit3_frequency': Counter(df['digit3'].dropna()).most_common(),
        }
        
        return analysis
    
    def find_hot_cold_numbers(self, market: str = None, window: int = 30) -> Dict:
        """
        Find hot (frequent) and cold (rare) numbers
        
        Args:
            market: Specific market to analyze
            window: Number of recent records to consider
        """
        df = self.panel_data
        
        if market:
            df = df[df['market'] == market]
        
        # Get recent records
        recent_df = df.tail(window)
        
        if recent_df.empty:
            return {}
        
        # Count panel occurrences
        panel_counts = Counter(recent_df['panel'].dropna())
        
        # Hot numbers (top 10 most frequent)
        hot_numbers = panel_counts.most_common(10)
        
        # Cold numbers (least frequent, but appeared at least once)
        all_panels = set(recent_df['panel'].dropna())
        cold_numbers = [(panel, count) for panel, count in panel_counts.most_common()[-10:]]
        
        # Numbers that haven't appeared
        all_possible_panels = set([f"{i}{j}{k}" for i in range(10) for j in range(10) for k in range(10)])
        never_appeared = all_possible_panels - all_panels
        
        return {
            'hot_numbers': hot_numbers,
            'cold_numbers': cold_numbers,
            'never_appeared_count': len(never_appeared),
            'never_appeared_sample': list(never_appeared)[:20]
        }
    
    def analyze_sutta_patterns(self, market: str = None) -> Dict:
        """Analyze which suttas appear most frequently"""
        df = self.panel_data
        
        if market:
            df = df[df['market'] == market]
        
        sutta_counts = Counter(df['calculated_sutta'].dropna())
        total = sum(sutta_counts.values())
        
        sutta_analysis = {}
        for sutta in range(10):
            count = sutta_counts.get(str(sutta), 0)
            percentage = (count / total * 100) if total > 0 else 0
            sutta_analysis[str(sutta)] = {
                'count': count,
                'percentage': round(percentage, 2)
            }
        
        return sutta_analysis
    
    def find_sequential_patterns(self, market: str = None) -> Dict:
        """Find if sequential numbers appear together"""
        df = self.panel_data
        
        if market:
            df = df[df['market'] == market]
        
        patterns = {
            'sequential': 0,  # 123, 234, 345
            'reverse_sequential': 0,  # 321, 432, 543
            'same_digits': 0,  # 111, 222, 333
            'two_same': 0,  # 112, 223, 334
            'all_different': 0  # 147, 258, 369
        }
        
        for _, row in df.iterrows():
            panel = row['panel']
            if pd.isna(panel):
                continue
            
            # Convert to string to handle both int and string types
            panel_str = str(panel).zfill(3)  # Pad with zeros if needed
            if len(panel_str) != 3:
                continue
            
            d1, d2, d3 = int(panel_str[0]), int(panel_str[1]), int(panel_str[2])
            
            # Check patterns
            if d1 == d2 == d3:
                patterns['same_digits'] += 1
            elif d1 == d2 or d2 == d3 or d1 == d3:
                patterns['two_same'] += 1
            else:
                patterns['all_different'] += 1
            
            # Sequential check
            if d2 == d1 + 1 and d3 == d2 + 1:
                patterns['sequential'] += 1
            elif d2 == d1 - 1 and d3 == d2 - 1:
                patterns['reverse_sequential'] += 1
        
        total = sum(patterns.values())
        patterns_percentage = {k: round(v/total*100, 2) if total > 0 else 0 
                              for k, v in patterns.items()}
        
        return {
            'counts': patterns,
            'percentages': patterns_percentage
        }
    
    def analyze_day_patterns(self, market: str = None) -> Dict:
        """Analyze if certain days have patterns"""
        df = self.panel_data
        
        if market:
            df = df[df['market'] == market]
        
        day_analysis = {}
        
        for day in df['day'].unique():
            day_df = df[df['day'] == day]
            
            if not day_df.empty:
                day_analysis[day] = {
                    'total_records': len(day_df),
                    'most_common_sutta': Counter(day_df['calculated_sutta'].dropna()).most_common(3),
                    'most_common_panels': Counter(day_df['panel'].dropna()).most_common(5)
                }
        
        return day_analysis
    
    def generate_report(self, market: str = None) -> str:
        """Generate a comprehensive analysis report"""
        if self.panel_data is None:
            self.load_latest_data()
        
        report = []
        report.append("=" * 80)
        report.append("MATKA DATA ANALYSIS REPORT")
        report.append("=" * 80)
        report.append("")
        
        if market:
            report.append(f"Market: {market}")
        else:
            report.append("Market: ALL MARKETS")
        
        report.append(f"Total Records: {len(self.panel_data)}")
        report.append("")
        
        # Frequency Analysis
        report.append("-" * 80)
        report.append("FREQUENCY ANALYSIS")
        report.append("-" * 80)
        freq = self.analyze_frequency(market)
        
        report.append("\nTop 10 Most Frequent Panels:")
        for panel, count in freq['panel_frequency'][:10]:
            report.append(f"  {panel}: {count} times")
        
        report.append("\nSutta Distribution:")
        for sutta, count in freq['sutta_frequency']:
            report.append(f"  Sutta {sutta}: {count} times")
        
        # Hot/Cold Analysis
        report.append("\n" + "-" * 80)
        report.append("HOT & COLD NUMBERS (Last 30 Results)")
        report.append("-" * 80)
        hot_cold = self.find_hot_cold_numbers(market, window=30)
        
        report.append("\n🔥 HOT Numbers:")
        for panel, count in hot_cold['hot_numbers']:
            report.append(f"  {panel}: {count} times")
        
        report.append("\n❄️ COLD Numbers:")
        for panel, count in hot_cold['cold_numbers']:
            report.append(f"  {panel}: {count} times")
        
        # Sutta Patterns
        report.append("\n" + "-" * 80)
        report.append("SUTTA PATTERN ANALYSIS")
        report.append("-" * 80)
        sutta_patterns = self.analyze_sutta_patterns(market)
        
        for sutta, data in sorted(sutta_patterns.items()):
            report.append(f"  Sutta {sutta}: {data['count']} times ({data['percentage']}%)")
        
        # Sequential Patterns
        report.append("\n" + "-" * 80)
        report.append("SEQUENTIAL PATTERN ANALYSIS")
        report.append("-" * 80)
        seq_patterns = self.find_sequential_patterns(market)
        
        report.append("\nPattern Distribution:")
        for pattern, percentage in seq_patterns['percentages'].items():
            count = seq_patterns['counts'][pattern]
            report.append(f"  {pattern}: {count} times ({percentage}%)")
        
        # Day Patterns
        report.append("\n" + "-" * 80)
        report.append("DAY-WISE PATTERN ANALYSIS")
        report.append("-" * 80)
        day_patterns = self.analyze_day_patterns(market)
        
        for day, data in day_patterns.items():
            report.append(f"\n{day}:")
            report.append(f"  Total: {data['total_records']}")
            report.append(f"  Top Suttas: {data['most_common_sutta'][:3]}")
        
        report.append("\n" + "=" * 80)
        
        return "\n".join(report)
    
    def save_report(self, market: str = None, filename: str = None):
        """Save analysis report to file"""
        report = self.generate_report(market)
        
        if filename is None:
            market_name = market.replace(" ", "_").lower() if market else "all_markets"
            filename = f"{self.data_dir}/analysis_report_{market_name}.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"💾 Report saved to: {filename}")
        return filename


def main():
    """Run analysis on scraped data"""
    print("🔍 Starting Matka Data Analysis\n")
    
    analyzer = MatkaDataAnalyzer()
    
    # Load data
    df = analyzer.load_latest_data()
    
    if df.empty:
        print("❌ No data to analyze. Run the scraper first!")
        return
    
    # Get list of markets
    markets = df['market'].unique()
    print(f"\n📊 Markets found: {', '.join(markets)}\n")
    
    # Generate reports for each market
    for market in markets:
        print(f"Analyzing {market}...")
        analyzer.save_report(market)
    
    # Generate overall report
    print("Analyzing all markets combined...")
    analyzer.save_report()
    
    # Print summary to console
    print("\n" + "="*80)
    print("QUICK SUMMARY")
    print("="*80)
    
    for market in markets:
        print(f"\n{market}:")
        hot_cold = analyzer.find_hot_cold_numbers(market, window=30)
        print(f"  🔥 Hottest: {hot_cold['hot_numbers'][0] if hot_cold['hot_numbers'] else 'N/A'}")
        print(f"  ❄️ Coldest: {hot_cold['cold_numbers'][0] if hot_cold['cold_numbers'] else 'N/A'}")
    
    print("\n✅ Analysis complete! Check the data/ directory for detailed reports.")


if __name__ == "__main__":
    main()
