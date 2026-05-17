"""
Advanced Matka Data Scraper with better HTML parsing
Handles complex table structures from DBboss website
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
from datetime import datetime
import time
import re
from typing import List, Dict, Optional, Tuple

class AdvancedMatkaScaper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
    def parse_date_range(self, date_text: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse date range like '12/06/2023 to 16/06/2023'"""
        try:
            if 'to' in date_text:
                parts = date_text.split('to')
                start_date = parts[0].strip()
                end_date = parts[1].strip()
                return start_date, end_date
            return date_text.strip(), date_text.strip()
        except:
            return None, None
    
    def extract_panel_number(self, text: str) -> Optional[str]:
        """Extract 3-digit panel number from text"""
        # Look for 3 consecutive digits
        match = re.search(r'\b(\d)\s*(\d)\s*(\d)\b', text)
        if match:
            return match.group(1) + match.group(2) + match.group(3)
        return None
    
    def extract_jodi_number(self, text: str) -> Optional[str]:
        """Extract 2-digit jodi number from text"""
        match = re.search(r'\b(\d{2})\b', text)
        if match:
            return match.group(1)
        return None
    
    def scrape_panel_chart_detailed(self, url: str, market_name: str) -> pd.DataFrame:
        """
        Scrape panel chart with detailed parsing
        Returns flattened data with one row per result
        """
        try:
            print(f"📥 Fetching {market_name} Panel Chart...")
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all tables (some pages have multiple)
            tables = soup.find_all('table')
            
            if not tables:
                print(f"❌ No tables found for {market_name}")
                return pd.DataFrame()
            
            all_data = []
            
            # Process each table
            for table_idx, table in enumerate(tables):
                rows = table.find_all('tr')
                
                # Try to identify header row
                header_row = rows[0] if rows else None
                headers = []
                
                if header_row:
                    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
                
                # Process data rows
                for row_idx, row in enumerate(rows[1:], 1):
                    cols = row.find_all('td')
                    
                    if len(cols) < 2:
                        continue
                    
                    # First column is usually date range
                    date_cell = cols[0].get_text(strip=True)
                    start_date, end_date = self.parse_date_range(date_cell)
                    
                    # Process each day's data
                    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    
                    for col_idx, col in enumerate(cols[1:], 1):
                        cell_text = col.get_text(strip=True)
                        
                        # Extract all numbers from the cell
                        numbers = re.findall(r'\d+', cell_text)
                        
                        if numbers:
                            # Try to identify panel (3 digits) and other numbers
                            panel = None
                            sutta = None
                            
                            for num in numbers:
                                if len(num) == 3:
                                    panel = num
                                elif len(num) == 2:
                                    sutta = num
                                elif len(num) == 1:
                                    # Single digit might be part of panel
                                    pass
                            
                            if panel:
                                day_name = days[col_idx - 1] if col_idx - 1 < len(days) else f"Day{col_idx}"
                                
                                all_data.append({
                                    'market': market_name,
                                    'date_range_start': start_date,
                                    'date_range_end': end_date,
                                    'day': day_name,
                                    'panel': panel,
                                    'sutta': sutta,
                                    'digit1': panel[0] if panel else None,
                                    'digit2': panel[1] if panel else None,
                                    'digit3': panel[2] if panel else None,
                                    'scraped_at': datetime.now().isoformat()
                                })
            
            df = pd.DataFrame(all_data)
            
            if not df.empty:
                # Calculate sutta if not present
                df['calculated_sutta'] = df.apply(
                    lambda row: str((int(row['digit1']) + int(row['digit2']) + int(row['digit3'])) % 10) 
                    if row['digit1'] and row['digit2'] and row['digit3'] else None,
                    axis=1
                )
                
                print(f"✅ Scraped {len(df)} panel records from {market_name}")
            else:
                print(f"⚠️ No data extracted from {market_name}")
            
            return df
            
        except Exception as e:
            print(f"❌ Error scraping {market_name} Panel: {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame()
    
    def scrape_current_result(self, url: str, market_name: str) -> Dict:
        """Scrape the current/latest result from the page"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for current result display (usually in a prominent div/span)
            result_patterns = [
                soup.find('div', class_=re.compile(r'result|current', re.I)),
                soup.find('span', class_=re.compile(r'result|current', re.I)),
                soup.find('h2', string=re.compile(r'result', re.I)),
            ]
            
            for element in result_patterns:
                if element:
                    text = element.get_text(strip=True)
                    numbers = re.findall(r'\d+', text)
                    if numbers:
                        return {
                            'market': market_name,
                            'current_result': '-'.join(numbers),
                            'timestamp': datetime.now().isoformat()
                        }
            
            return {}
            
        except Exception as e:
            print(f"Error fetching current result for {market_name}: {e}")
            return {}
    
    def scrape_all_markets_advanced(self, market_urls: Dict[str, Dict[str, str]]) -> Dict:
        """
        Scrape all markets with advanced parsing
        """
        results = {
            'panel_data': [],
            'jodi_data': [],
            'current_results': [],
            'metadata': {
                'scraped_at': datetime.now().isoformat(),
                'total_markets': len(market_urls),
                'markets': list(market_urls.keys())
            }
        }
        
        for market_name, urls in market_urls.items():
            print(f"\n{'='*60}")
            print(f"🎯 Processing: {market_name}")
            print(f"{'='*60}")
            
            # Scrape panel chart
            if 'panel' in urls:
                panel_df = self.scrape_panel_chart_detailed(urls['panel'], market_name)
                if not panel_df.empty:
                    results['panel_data'].append(panel_df)
                
                # Also try to get current result
                current = self.scrape_current_result(urls['panel'], market_name)
                if current:
                    results['current_results'].append(current)
            
            # Scrape jodi chart (similar logic)
            if 'jodi' in urls:
                # TODO: Implement jodi scraping
                pass
            
            # Be nice to the server
            time.sleep(2)
        
        # Combine all panel data
        if results['panel_data']:
            results['panel_data'] = pd.concat(results['panel_data'], ignore_index=True)
        else:
            results['panel_data'] = pd.DataFrame()
        
        return results
    
    def save_results(self, results: Dict, output_dir: str = "data"):
        """Save scraped results to files"""
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save panel data
        if isinstance(results['panel_data'], pd.DataFrame) and not results['panel_data'].empty:
            panel_file = f"{output_dir}/panel_data_{timestamp}.csv"
            results['panel_data'].to_csv(panel_file, index=False)
            print(f"💾 Saved panel data: {panel_file}")
            
            # Also save as JSON
            json_file = f"{output_dir}/panel_data_{timestamp}.json"
            results['panel_data'].to_json(json_file, orient='records', indent=2)
            print(f"💾 Saved panel JSON: {json_file}")
        
        # Save current results
        if results['current_results']:
            current_file = f"{output_dir}/current_results_{timestamp}.json"
            with open(current_file, 'w') as f:
                json.dump(results['current_results'], f, indent=2)
            print(f"💾 Saved current results: {current_file}")
        
        # Save metadata
        metadata_file = f"{output_dir}/metadata_{timestamp}.json"
        with open(metadata_file, 'w') as f:
            json.dump(results['metadata'], f, indent=2)
        print(f"💾 Saved metadata: {metadata_file}")
        
        print(f"\n✅ All data saved to {output_dir}/")


def main():
    """Main execution"""
    
    # Load market URLs from JSON config
    try:
        with open('market_urls.json', 'r') as f:
            config = json.load(f)
            market_urls = {name: data for name, data in config['markets'].items() if data.get('enabled', True)}
    except FileNotFoundError:
        print("❌ market_urls.json not found! Using default markets...")
        market_urls = {
            "Kalyan Morning": {"panel": "https://dpbosss.net.in/kalyan-morning-panel-chart.php"},
            "Time Bazar": {"panel": "https://dpbosss.net.in/time-bazar-panel.php"}
        }
    
    print("🚀 Starting Advanced Matka Data Scraper")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🎯 Markets to scrape: {len(market_urls)}\n")
    
    scraper = AdvancedMatkaScaper()
    results = scraper.scrape_all_markets_advanced(market_urls)
    
    # Print summary
    print(f"\n{'='*60}")
    print("📊 SCRAPING SUMMARY")
    print(f"{'='*60}")
    
    if isinstance(results['panel_data'], pd.DataFrame):
        print(f"✅ Total panel records: {len(results['panel_data'])}")
        print(f"✅ Markets covered: {results['panel_data']['market'].nunique()}")
        print(f"✅ Date range: {results['panel_data']['date_range_start'].min()} to {results['panel_data']['date_range_end'].max()}")
    
    print(f"✅ Current results: {len(results['current_results'])}")
    
    # Save everything
    scraper.save_results(results)
    
    print(f"\n🎉 Scraping completed successfully!")


if __name__ == "__main__":
    main()
