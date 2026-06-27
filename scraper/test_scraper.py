"""
Test script to verify scraper works on a single market
"""

from advanced_scraper import AdvancedMatkaScaper
import json

def test_single_market():
    """Test scraping a single market"""
    
    print("🧪 Testing scraper on Kalyan market...\n")
    
    scraper = AdvancedMatkaScaper()
    
    # Test single market
    test_url = "https://dpbossss.boston/panel-chart-record/kalyan.php"
    test_market = "Kalyan"
    
    df = scraper.scrape_panel_chart_detailed(test_url, test_market)
    
    if not df.empty:
        print(f"\n✅ SUCCESS! Scraped {len(df)} records")
        print(f"\nFirst 5 records:")
        print(df.head())
        print(f"\nColumns: {list(df.columns)}")
        print(f"\nMarkets: {df['market'].unique()}")
        print(f"\nDate range: {df['date_range_start'].min()} to {df['date_range_end'].max()}")
        
        # Save test data
        df.to_csv('data/test_output.csv', index=False)
        print(f"\n💾 Saved test data to data/test_output.csv")
        
        return True
    else:
        print("\n❌ FAILED! No data scraped")
        print("Check:")
        print("  1. Internet connection")
        print("  2. URL is correct")
        print("  3. Website is accessible")
        return False

if __name__ == "__main__":
    import os
    os.makedirs('data', exist_ok=True)
    
    success = test_single_market()
    
    if success:
        print("\n🎉 Test passed! You can now run: python run_all.py")
    else:
        print("\n⚠️ Test failed. Check the errors above.")
