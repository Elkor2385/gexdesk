let mainChart = null;
let globalData = {};
let currentSymbol = 'SPY';
let currentMetric = 'gex'; // GEX افتراضياً

document.addEventListener("DOMContentLoaded", () => {
    loadLiveData();
    setInterval(() => loadLiveData(true), 5000);
});

function loadLiveData(isSilent = false) {
    fetch('data.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(result => {
            const timeEl = document.getElementById('last-update');
            if(timeEl) timeEl.innerText = `LIVE AUTO-FEED: ${new Date(result.last_updated).toLocaleTimeString()}`;
            globalData = result.data;
            if (!globalData[currentSymbol]) currentSymbol = Object.keys(globalData)[0];
            if (!isSilent) {
                renderTickersRow();
                renderSymbolView(currentSymbol);
            } else {
                updateDynamicValues();
            }
        }).catch(err => console.log("Waiting..."));
}

function renderTickersRow() {
    const container = document.getElementById('tickers-row');
    if (!container) return;
    container.innerHTML = '';
    for (let symbol in globalData) {
        const item = globalData[symbol];
        const isPos = item.change_percent >= 0;
        const card = document.createElement('div');
        card.className = `ticker-card ${symbol === currentSymbol ? 'active' : ''}`;
        card.innerHTML = `
            <div>
                <div class="symbol">${symbol}</div>
                <div class="price" id="price-${symbol}">$${item.price || 0}</div>
            </div>
            <div class="change ${isPos ? 'positive' : 'negative'}" style="text-align: right;">
                ${isPos ? '+' : ''}${item.change_percent || 0}%
            </div>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentSymbol = symbol;
            renderSymbolView(symbol);
        });
        container.appendChild(card);
    }
}

function updateDynamicValues() {
    for (let symbol in globalData) {
        const pEl = document.getElementById(`price-${symbol}`);
        if (pEl) pEl.innerText = `$${globalData[symbol].price}`;
    }
    if (mainChart && currentSymbol && globalData[currentSymbol]) {
        updateChartData();
    }
}

function setMetric(metric) {
    currentMetric = metric;
    document.querySelectorAll('.metric-buttons button').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    renderSymbolView(currentSymbol);
}

function updateChartData() {
    const item = globalData[currentSymbol];
    if (!item || !mainChart) return;
    
    if (currentMetric === 'gex') {
        mainChart.data.datasets[0].data = item.call_gex || [];
        mainChart.data.datasets[1].data = item.put_gex || [];
        mainChart.data.datasets[0].label = 'Call GEX ($M)';
        mainChart.data.datasets[1].label = 'Put GEX ($M)';
        mainChart.data.datasets[0].backgroundColor = '#00e676';
        mainChart.data.datasets[1].backgroundColor = '#ff1744';
    } else if (currentMetric === 'dex') {
        mainChart.data.datasets[0].data = item.dex || [];
        mainChart.data.datasets[1].data = (item.dex || []).map(v => -v);
        mainChart.data.datasets[0].label = 'DEX Exposure';
        mainChart.data.datasets[1].label = 'Inverted DEX';
        mainChart.data.datasets[0].backgroundColor = '#00e676';
        mainChart.data.datasets[1].backgroundColor = '#ff1744';
    } else if (currentMetric === 'vanna') {
        mainChart.data.datasets[0].data = item.vanna || [];
        mainChart.data.datasets[1].data = (item.vanna || []).map(v => -v);
        mainChart.data.datasets[0].label = 'Vanna Impact';
        mainChart.data.datasets[1].label = 'Inverted Vanna';
        mainChart.data.datasets[0].backgroundColor = '#00e676';
        mainChart.data.datasets[1].backgroundColor = '#ff1744';
    }
    mainChart.update('none');
}

function renderSymbolView(symbol) {
    try {
        const item = globalData[symbol];
        if (!item) return;

        const titleEl = document.getElementById('chart-title');
        if (titleEl) titleEl.innerText = `${symbol} - GREEKS & OPTIONS FLOW`;

        const levelsBox = document.getElementById('key-levels');
        if (levelsBox) {
            levelsBox.innerHTML = `
                <div class="level-tag">Gamma Flip: <span>$${item.gamma_flip}</span></div>
                <div class="level-tag">Call Wall: <span>$${item.call_wall}</span></div>
                <div class="level-tag">Put Wall: <span>$${item.put_wall}</span></div>
            `;
        }

        const chartCanvas = document.getElementById('gexChart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            if (mainChart) mainChart.destroy();

            let initialDatasets = [
                { label: 'Call GEX ($M)', data: item.call_gex || [], backgroundColor: '#00e676' },
                { label: 'Put GEX ($M)', data: item.put_gex || [], backgroundColor: '#ff1744' }
            ];

            if (currentMetric === 'dex') {
                initialDatasets = [
                    { label: 'DEX Exposure', data: item.dex || [], backgroundColor: '#00e676' },
                    { label: 'Inverted DEX', data: (item.dex || []).map(v => -v), backgroundColor: '#ff1744' }
                ];
            } else if (currentMetric === 'vanna') {
                initialDatasets = [
                    { label: 'Vanna Impact', data: item.vanna || [], backgroundColor: '#00e676' },
                    { label: 'Inverted Vanna', data: (item.vanna || []).map(v => -v), backgroundColor: '#ff1744' }
                ];
            }

            mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: item.strikes || [],
                    datasets: initialDatasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { color: '#162035' }, ticks: { color: '#64748b', font: { size: 10 } } },
                        y: { grid: { color: '#162035' }, ticks: { color: '#64748b', font: { size: 10 } } }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5e1', font: { size: 11, weight: '600' } } },
                        tooltip: {
                            backgroundColor: '#162035',
                            titleColor: '#00f0ff',
                            bodyColor: '#e2e8f0',
                            borderColor: '#1d293d',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: true,
                        }
                    }
                }
            });
            updateChartData();
        }

        const tbody = document.getElementById('exp-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            (item.expirations_table || []).forEach(row => {
                const tr = document.createElement('tr');
                const isPos = (row.net_gex >= 0);
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
    } catch (e) {
        console.log("Error", e);
    }
}
