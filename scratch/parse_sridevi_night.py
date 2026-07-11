import requests
from bs4 import BeautifulSoup
import re

url = "https://dpbossss.boston/panel-chart-record/sridevi-night.php"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

print("Fetching Sridevi Night live data...")
res = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(res.content, 'html.parser')

table = soup.find('table')
if not table:
    print("No table found")
    exit(1)

rows = table.find_all('tr')
print(f"Total rows: {len(rows)}")

# Find the row containing "06/07/2026"
for row in rows:
    cells = row.find_all('td')
    if not cells:
        continue
    cell0_text = cells[0].get_text(strip=True)
    if "06/07/2026" in cell0_text:
        print("\n--- FOUND CURRENT WEEK ROW ---")
        print(f"Date Range: {cell0_text}")
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        for idx, cell in enumerate(cells[1:], 1):
            text = cell.get_text(separator='|', strip=True)
            day_name = days[idx - 1] if idx - 1 < len(days) else f"Col {idx}"
            print(f"Col {idx} ({day_name}): {text}")
