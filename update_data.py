import json
from datetime import datetime, timezone
import yfinance as yf
import numpy as np

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

        total_gex = 0.0
        total_dex = 0.0
        total_volume = 0
        total_oi = 0

        # حساب تقريبي احترافي لـ GEX و DEX باستخدام أول تاريخ صلاحية متاح (0DTE/Near-term)
        if expiration_dates:
            opt_chain = tk.option_chain(expiration_dates[0])
            calls = opt_chain.calls
            puts = opt_chain.puts

            # حساب تجميعي مبسط بناء على الـ Open Interest والـ Gamma/Delta
            for _, row in calls.iterrows():
                oi = row.get('openInterest', 0) or 0
                vol = row.get('volume', 0) or 0
                gamma = row.get('gamma', 0.0) or 0.0
                delta = row.get('delta', 0.0) or 0.0
                
                total_gex += gamma * oi * 100 * current_price * current_price * 0.01
                total_dex += delta * oi * 100 * current_price
                total_volume += int(vol)
                total_oi += int(oi)

            for _, row in puts.iterrows():
                oi = row.get('openInterest', 0) or 0
                vol = row.get('volume', 0) or 0
                gamma = row.get('gamma', 0.0) or 0.0
                delta = row.get('delta', 0.0) or 0.0
                
                # وضع علامة سالبة لليونكس الخاصة بالبوتات في الـ GEX
                total_gex -= gamma * oi * 100 * current_price * current_price * 0.01
                total_dex += delta * oi * 100 * current_price
                total_volume += int(vol)
                total_oi += int(oi)

        market_data[symbol] = {
            "price": round(current_price, 2),
            "change_percent": round(change_pct, 2),
            "expirations": expiration_dates[:8],
            "gex": round(total_gex / 1e6, 25), # بالملايين ($M)
            "dex": round(total_dex / 1e6, 2), # بالملايين ($M)
            "volume": total_volume,
            "open_interest": total_oi
        }
    except Exception as e:
        print(f"Error fetching Greeks for {symbol}: {e}")

output = {
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "data": market_data
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print("Advanced Greeks & Flow data.json updated successfully!")
