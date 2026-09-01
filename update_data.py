import json
import math
from datetime import datetime, timezone
import yfinance as yf

tickers = ["SPY", "NVDA", "TSLA", "QQQ", "USO", "GLD", "SLV", "AAPL", "IBIT", "ETHA"]
market_data = {}

def clean_val(val, default=0.0):
    """ تنظيف القيم الرياضية لتجنب NaN و Infinity التي تكسر JSON """
    if val is None or math.isnan(val) or math.isinf(val):
        return default
    return float(val)

for symbol in tickers:
    try:
        tk = yf.Ticker(symbol)
        hist = tk.history(period="5d", interval="15m")
        
        if not hist.empty:
            current_price = clean_val(hist["Close"].iloc[-1], 100.0)
            prev_close = clean_val(hist["Close"].iloc[0], current_price)
            change_pct = round(((current_price - prev_close) / prev_close) * 100, 2) if prev_close != 0 else 0.0
            sparkline = [round(clean_val(p, current_price), 2) for p in hist["Close"].iloc[-25:].tolist()]
        else:
            current_price, change_pct, sparkline = 100.0, 0.0, []

        expiration_dates = list(tk.options) if hasattr(tk, 'options') else []
        strike_data = {}
        exp_table_data = []

        for exp in expiration_dates[:10]:
            try:
                chain = tk.option_chain(exp)
                calls, puts = chain.calls, chain.puts
                
                exp_vol = int(calls['volume'].fillna(0).sum() + puts['volume'].fillna(0).sum())
                exp_oi = int(calls['openInterest'].fillna(0).sum() + puts['openInterest'].fillna(0).sum())
                call_vol = calls['volume'].fillna(0).sum()
                put_vol = puts['volume'].fillna(0).sum()
                cp_ratio = round(call_vol / put_vol, 2) if put_vol > 0 else 1.0

                net_exp_gex = 0.0

                for df, is_call in [(calls, True), (puts, False)]:
                    for _, row in df.iterrows():
                        strike = clean_val(row['strike'])
                        if strike == 0.0 or abs(strike - current_price) / current_price > 0.12:
                            continue
                        
                        oi = clean_val(row.get('openInterest', 0))
                        gamma = clean_val(row.get('gamma', 0.0))
                        delta = clean_val(row.get('delta', 0.0))
                        
                        gex_val = gamma * oi * 100 * (current_price ** 2) * 0.01 / 1e6
                        dex_val = delta * oi * 100 * current_price / 1e6
                        vanna_val = (delta * 0.05) * oi * 100 / 1e6

                        if strike not in strike_data:
                            strike_data[strike] = {"call_gex": 0.0, "put_gex": 0.0, "dex": 0.0, "vanna": 0.0}
                        
                        if is_call:
                            strike_data[strike]["call_gex"] += clean_val(gex_val)
                            net_exp_gex += clean_val(gex_val)
                        else:
                            strike_data[strike]["put_gex"] -= clean_val(gex_val)
                            net_exp_gex -= clean_val(gex_val)
                        
                        strike_data[strike]["dex"] += clean_val(dex_val)
                        strike_data[strike]["vanna"] += clean_val(vanna_val if is_call else -vanna_val)

                exp_table_data.append({
                    "date": exp,
                    "vol": f"{round(exp_vol/1000, 1)}K",
                    "oi": f"{round(exp_oi/1000, 1)}K",
                    "net_gex": round(clean_val(net_exp_gex), 2),
                    "cp_ratio": clean_val(cp_ratio, 1.0)
                })
            except Exception:
                continue

        sorted_strikes = sorted(strike_data.keys())
        
        if sorted_strikes:
            max_call_wall = max(sorted_strikes, key=lambda s: strike_data[s]["call_gex"])
            max_put_wall = min(sorted_strikes, key=lambda s: strike_data[s]["put_gex"])
            gamma_flip = current_price
            for s in sorted_strikes:
                if (strike_data[s]["call_gex"] + strike_data[s]["put_gex"]) >= 0:
                    gamma_flip = s
                    break
        else:
            max_call_wall, max_put_wall, gamma_flip = current_price, current_price, current_price

        market_data[symbol] = {
            "price": round(current_price, 2),
            "change_percent": change_pct,
            "sparkline": sparkline,
            "gamma_flip": round(gamma_flip, 2),
            "call_wall": round(max_call_wall, 2),
            "put_wall": round(max_put_wall, 2),
            "strikes": sorted_strikes,
            "call_gex": [round(clean_val(strike_data[s]["call_gex"]), 2) for s in sorted_strikes],
            "put_gex": [round(clean_val(strike_data[s]["put_gex"]), 2) for s in sorted_strikes],
            "dex": [round(clean_val(strike_data[s]["dex"]), 2) for s in sorted_strikes],
            "vanna": [round(clean_val(strike_data[s]["vanna"]), 2) for s in sorted_strikes],
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

print("Clean JSON without NaNs generated successfully!")
