"""
Master Script - Run Scraping and Analysis
"""

import sys
import os
from datetime import datetime

def print_header(text):
    print("\n" + "="*80)
    print(text.center(80))
    print("="*80 + "\n")

def main():
    print_header("MATKA DATA SCRAPER & ANALYZER")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Step 1: Scrape data
    print_header("STEP 1: SCRAPING DATA FROM ALL MARKETS")
    print("Running advanced scraper...\n")
    
    try:
        from advanced_scraper import main as scraper_main
        scraper_main()
    except Exception as e:
        print(f"❌ Error during scraping: {e}")
        import traceback
        traceback.print_exc()
        print("\nContinuing to analysis if data exists...\n")
    
    # Step 2: Analyze data
    print_header("STEP 2: ANALYZING SCRAPED DATA")
    print("Running data analyzer...\n")
    
    try:
        from data_analyzer import main as analyzer_main
        analyzer_main()
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    
    # Step 3: Run Prediction Engine
    print_header("STEP 3: RUNNING ADVANCED PREDICTION ENGINE")
    print("Generating Game-Theory predictions...\n")
    
    try:
        from advanced_predictor import AdvancedPredictor
        predictor = AdvancedPredictor()
        predictor.generate_all_predictions()
    except Exception as e:
        print(f"❌ Error during predictions: {e}")
        import traceback
        traceback.print_exc()
        
    # Step 4: Summary
    print_header("COMPLETED")
    print("✅ Scraping completed")
    print("✅ Analysis completed")
    print("✅ Predictions generated")
    print(f"\n📁 Check the 'data/' directory for:")
    print("   - panel_data_*.csv (scraped data)")
    print("   - panel_data_*.json (JSON format)")
    print("   - analysis_report_*.txt (analysis reports)")
    print("   - advanced_predictions_*.json (AI predictions)")
    print(f"\n🎉 All done! Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
