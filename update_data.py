import json
from datetime import datetime, timezone
import yfinance as yf

tickers = ["SPY", "NVDA", "TSLA", "QQQ", "USO", "GLD", "SLV", "AAPL", "IBIT", "ETHA"]
market_data = {}

for symbol in tickers:
    try:
        tk = yf.Ticker(symbol)
        hist = tk.history(period="5d", interval="15m")
        
        if not hist.empty:
            current_price = float(hist["Close"].iloc[-1])
            prev_close = float(hist["Close"].iloc[0])
            change_pct = round(((current_price - prev_close) / prev_close) * 100, 2)
            sparkline = [round(p, 2) for p in hist["Close"].iloc[-20:].tolist()]
        else:
            current_price, change_pct, sparkline = 100.0, 0.0, []

        expiration_dates = list(tk.options) if hasattr(tk, 'options') else []
        strike_data = {}
        exp_table_data = []

        for exp in expiration_dates[:8]:
            try:
                chain = tk.option_chain(exp)
                calls, puts = chain.calls, chain.puts
                
                exp_vol = int(calls['volume'].fillna(0).sum() + puts['volume'].fillna(0).sum())
                exp_oi = int(calls['openInterest'].fillna(0).sum() + puts['openInterest'].fillna(0).sum())
                call_vol = calls['volume'].fillna(0).sum()
                put_vol = puts['volume'].fillna(0).sum()
                cp_ratio = round(call_vol / put_vol, 2) if put_vol > 0 else 1.0

                exp_gex = 0.0
                
                for df, multiplier in [(calls, 1), (puts, -1)]:
                    for _, row in df.iterrows():
                        strike = float(row['strike'])
                        if abs(strike - current_price) / current_price > 0.10:
                            continue
                        
                        oi = float(row.get('openInterest', 0) or 0)
                        gamma = float(row.get('gamma', 0.0) or 0.0)
                        delta = float(row.get('delta', 0.0) or 0.0)
                        
                        gex_val = multiplier * gamma * oi * 100 * (current_price ** 2) * 0.01 / 1e6
                        dex_val = delta * oi * 100 * current_price / 1e6
                        vanna_val = multiplier * (delta * 0.05) * oi * 100 / 1e6
                        
                        exp_gex += gex_val
                        
                        if strike not in strike_data:
                            strike_data[strike] = {"gex": 0.0, "dex": 0.0, "vanna": 0.0}
                        
                        strike_data[strike]["gex"] += gex_val
                        strike_data[strike]["dex"] += dex_val
                        strike_data[strike]["vanna"] += vanna_val

                exp_table_data.append({
                    "date": exp,
                    "vol": f"{round(exp_vol/1000, 2)}K",
                    "oi": f"{round(exp_oi/1000, 2)}K",
                    "net_gex": round(exp_gex, 2),
                    "cp_ratio": cp_ratio
                })
            except Exception:
                continue

        sorted_strikes = sorted(strike_data.keys())
        filtered_strikes = sorted_strikes[::2] if len(sorted_strikes) > 25 else sorted_strikes

        market_data[symbol] = {
            "price": round(current_price, 2),
            "change_percent": change_pct,
            "sparkline": sparkline,
            "strikes": filtered_strikes,
            "gex": [round(strike_data[s]["gex"], 2) for s in filtered_strikes],
            "dex": [round(strike_data[s]["dex"], 2) for s in filtered_strikes],
            "vanna": [round(strike_data[s]["vanna"], 2) for s in filtered_strikes],
            "expirations_table": exp_table_data
        }
    except Exception as e:
        print(f"Error {symbol}: {e}")

output = {
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "data": market_data
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print("Pro GEXBot data updated successfully!")
