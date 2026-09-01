let mainChart = null;
let globalData = {};
let currentSymbol = 'SPY';

document.addEventListener("DOMContentLoaded", () => {
    loadLiveData();
    
    // تحديث صامت كل 5 ثواني
    setInterval(() => {
        loadLiveData(true);
    }, 5000);
});

function loadLiveData(isSilent = false) {
    // إضافة طابع زمني لتفادي مشكل الـ Cache
    fetch('data.json?t=' + new Date().getTime())
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(result => {
            const timeEl = document.getElementById('last-update');
            if(timeEl) timeEl.innerText = `LIVE AUTO-FEED: ${new Date(result.last_updated).toLocaleTimeString()}`;
            
            globalData = result.data;
            
            // التأكد من أن السهم الحالي موجود في البيانات
            if (!globalData[currentSymbol]) {
                currentSymbol = Object.keys(globalData)[0];
            }

            if (!isSilent) {
                renderTickersRow();
                if (currentSymbol) renderSymbolView(currentSymbol);
            } else {
                updateDynamicValues();
            }
        })
        .catch(err => console.error("Error loading data:", err));
}

function renderTickersRow() {
    const container = document.getElementById('tickers-row');
    if (!container) return; // حماية من الكراش
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
                <div class="price" id="price-${symbol}">$${item.price || 0}</div>
                <div class="change ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${item.change_percent || 0}%</div>
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
        renderSparkline(symbol, item.sparkline || [], isPos);
    }
}

function updateDynamicValues() {
    for (let symbol in globalData) {
        const pEl = document.getElementById(`price-${symbol}`);
        if (pEl) {
            const oldText = pEl.innerText.replace('$', '');
            const oldP = parseFloat(oldText);
            const newP = globalData[symbol].price;
            pEl.innerText = `$${newP}`;
            
            // وميض أخضر أو أحمر عند تغير السعر
            if (newP > oldP) {
                pEl.style.color = '#00e676';
                setTimeout(() => pEl.style.color = '', 1000);
            } else if (newP < oldP) {
                pEl.style.color = '#ff1744';
                setTimeout(() => pEl.style.color = '', 1000);
            }
        }
    }
    
    if (mainChart && currentSymbol && globalData[currentSymbol]) {
        const item = globalData[currentSymbol];
        mainChart.data.datasets[0].data = item.call_gex || [];
        mainChart.data.datasets[1].data = item.put_gex || [];
        mainChart.update('none'); // تحديث الشارت بدون أنيميشن مزعجة
    }
}

function renderSparkline(symbol, data, isPos) {
    const el = document.getElementById(`spark-${symbol}`);
    if (!el || !data || data.length === 0) return;
    
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
    try {
        const item = globalData[symbol];
        if (!item) return;

        // تحديث العنوان
        const titleEl = document.getElementById('chart-title');
        if (titleEl) {
            titleEl.innerText = `${symbol} - REAL-TIME GEX & OPTIONS FLOW`;
        }

        // تحديث المستويات المهمة (Gamma Flip, Walls)
        const levelsBox = document.getElementById('key-levels');
        if (levelsBox) {
            levelsBox.innerHTML = `
                <div class="level-tag">Gamma Flip: <span>$${item.gamma_flip || 0}</span></div>
                <div class="level-tag">Call Wall: <span>$${item.call_wall || 0}</span></div>
                <div class="level-tag">Put Wall: <span>$${item.put_wall || 0}</span></div>
            `;
        }

        // رسم الشارت الرئيسي
        const chartCanvas = document.getElementById('gexChart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            if (mainChart) mainChart.destroy();

            mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: item.strikes || [],
                    datasets: [
                        {
                            label: 'Call GEX ($M)',
                            data: item.call_gex || [],
                            backgroundColor: '#00e676',
                            stack: 'Stack 0'
                        },
                        {
                            label: 'Put GEX ($M)',
                            data: item.put_gex || [],
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
        }

        // رسم جدول الصلاحيات
        const tbody = document.getElementById('exp-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            const tableData = item.expirations_table || [];
            
            tableData.forEach(row => {
                const tr = document.createElement('tr');
                const isPos = (row.net_gex >= 0);
                tr.innerHTML = `
                    <td>📅 ${row.date || '-'}</td>
                    <td>${row.vol || 0}</td>
                    <td>${row.oi || 0}</td>
                    <td class="${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${row.net_gex || 0}M</td>
                    <td>${row.cp_ratio || 0}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("وقع خطأ أثناء رسم الشارت أو الجدول:", e);
    }
}
