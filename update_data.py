import json
from datetime import datetime, timezone
import yfinance as yf

# القائمة الكاملة التي اخترتها
tickers = ["SPY", "QQQ", "USO", "GLD", "SLV", "NVDA", "TSLA", "AAPL", "IBIT", "ETHA"]
market_data = {}

for symbol in tickers:
    try:
        tk = yf.Ticker(symbol)
        hist = tk.history(period="1d")
        current_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
        open_price = float(hist["Open"].iloc[-1]) if not hist.empty else current_price
        
        change_pct = ((current_price - open_price) / open_price * 100) if open_price != 0 else 0.0
        expiration_dates = list(tk.options) if hasattr(tk, 'options') else []

        market_data[symbol] = {
            "price": round(current_price, 2),
            "change_percent": round(change_pct, 2),
            "expirations": expiration_dates[:8],  # إظهار تواريخ الصلاحية القريبة (بما فيها 0DTE)
            "has_0dte": len(expiration_dates) > 0  # مؤشر مبدئي لوجود عقود Options
        }
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")

output = {
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "data": market_data
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print("Full Tickers Data.json updated successfully!")
