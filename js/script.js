let mainChart = null;
let globalData = {};
let currentSymbol = 'SPY';

document.addEventListener("DOMContentLoaded", () => {
    // التحميل الأول للبيانات
    loadLiveData();

    // إعداد التحديث اللحظي التلقائي كل 5 ثوانٍ (Real-Time Polling)
    setInterval(() => {
        loadLiveData(true); // true تعني تحديث صامت بدون إعادة رسم الواجهة كاملة
    }, 5000);
});

function loadLiveData(isSilent = false) {
    fetch('data.json?t=' + new Date().getTime()) // تجنب الـ Cache
        .then(res => res.json())
        .then(result => {
            document.getElementById('last-update').innerText = `LIVE AUTO-FEED: ${new Date(result.last_updated).toLocaleTimeString()}`;
            globalData = result.data;
            
            if (!isSilent) {
                renderTickersRow();
                renderSymbolView(currentSymbol);
            } else {
                updateDynamicValues();
            }
        })
        .catch(err => console.log("Live fetch waiting...", err));
}

function renderTickersRow() {
    const container = document.getElementById('tickers-row');
    container.innerHTML = '';
    
    for (let symbol in globalData) {
        const item = globalData[symbol];
        const isPos = item.change_percent >= 0;

        const card = document.createElement('div');
        card.className = `ticker-card ${symbol === currentSymbol ? 'active' : ''}`;
        card.id = `card-${symbol}`;
        card.innerHTML = `
            <div class="card-left">
                <div class="symbol">${symbol}</div>
                <div class="price" id="price-${symbol}">$${item.price}</div>
                <div class="change ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${item.change_percent}%</div>
            </div>
            <div class="sparkline-box">
                <canvas id="spark-${symbol}"></canvas>
            </div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentSymbol = symbol;
            renderSymbolView(symbol);
        });

        container.appendChild(card);
        renderSparkline(symbol, item.sparkline, isPos);
    }
}

function updateDynamicValues() {
    // تحديث قيم الأسعار في الكروت والشارت بشكل سلس
    for (let symbol in globalData) {
        const pEl = document.getElementById(`price-${symbol}`);
        if (pEl) {
            const oldP = parseFloat(pEl.innerText.replace('$', ''));
            const newP = globalData[symbol].price;
            pEl.innerText = `$${newP}`;
            
            if (newP > oldP) {
                pEl.style.color = '#00e676';
                setTimeout(() => pEl.style.color = '', 1000);
            } else if (newP < oldP) {
                pEl.style.color = '#ff1744';
                setTimeout(() => pEl.style.color = '', 1000);
            }
        }
    }
    
    // تحديث الشارت الحالي انسيابياً
    if (mainChart && globalData[currentSymbol]) {
        const item = globalData[currentSymbol];
        mainChart.data.datasets[0].data = item.call_gex;
        mainChart.data.datasets[1].data = item.put_gex;
        mainChart.update('none'); // تحديث بدون إعادة أنيميشن مزعجة
    }
}

function renderSparkline(symbol, data, isPos) {
    const el = document.getElementById(`spark-${symbol}`);
    if (!el) return;
    const ctx = el.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: isPos ? '#00e676' : '#ff1744',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function renderSymbolView(symbol) {
    const item = globalData[symbol];
    if (!item) return;

    document.getElementById('chart-title').innerText = `${symbol} - REAL-TIME GEX & OPTIONS FLOW`;

    const levelsBox = document.getElementById('key-levels');
    levelsBox.innerHTML = `
        <div class="level-tag">Gamma Flip: <span>$${item.gamma_flip}</span></div>
        <div class="level-tag">Call Wall: <span>$${item.call_wall}</span></div>
        <div class="level-tag">Put Wall: <span>$${item.put_wall}</span></div>
    `;

    const ctx = document.getElementById('gexChart').getContext('2d');
    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: item.strikes,
            datasets: [
                {
                    label: 'Call GEX ($M)',
                    data: item.call_gex,
                    backgroundColor: '#00e676',
                    stack: 'Stack 0'
                },
                {
                    label: 'Put GEX ($M)',
                    data: item.put_gex,
                    backgroundColor: '#ff1744',
                    stack: 'Stack 0'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            scales: {
                x: {
                    grid: { color: '#1d293d' },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#1d293d' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: '$ Millions GEX', color: '#64748b' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            }
        }
    });

    const tbody = document.getElementById('exp-tbody');
    tbody.innerHTML = '';
    item.expirations_table.forEach(row => {
        const tr = document.createElement('tr');
        const isPos = row.net_gex >= 0;
        tr.innerHTML = `
            <td>📅 ${row.date}</td>
            <td>${row.vol}</td>
            <td>${row.oi}</td>
            <td class="${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${row.net_gex}M</td>
            <td>${row.cp_ratio}</td>
        `;
        tbody.appendChild(tr);
    });
}
