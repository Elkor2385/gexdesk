import json
from datetime import datetime, timezone
import yfinance as yf

tickers = ["SPY", "NVDA", "TSLA", "QQQ"]
market_data = {}

for symbol in tickers:
    try:
        tk = yf.Ticker(symbol)
        hist = tk.history(period="1d")
        current_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
        open_price = float(hist["Open"].iloc[-1]) if not hist.empty else current_price

        change_pct = ((current_price - open_price) / open_price * 100) if open_price != 0 else 0.0
        expiration_dates = list(tk.options) if hasattr(tk, 'options') else []

        ticker_data = {
            "price": round(current_price, 2),
            "change_percent": round(change_pct, 2),
            "expirations": expiration_dates[:5]
        }
        market_data[symbol] = ticker_data
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")

output = {
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "data": market_data
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print("Data.json updated successfully!")
