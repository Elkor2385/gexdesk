let mainChart = null;
let sparklines = {};
let globalData = {};

document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(res => res.json())
        .then(result => {
            document.getElementById('last-update').innerText = `Last Updated: ${new Date(result.last_updated).toLocaleTimeString()}`;
            globalData = result.data;
            
            const container = document.getElementById('tickers-row');
            container.innerHTML = '';
            
            let firstSymbol = null;
            for (let symbol in globalData) {
                if (!firstSymbol) firstSymbol = symbol;
                const item = globalData[symbol];
                const isPos = item.change_percent >= 0;

                const card = document.createElement('div');
                card.className = 'ticker-card';
                card.id = `card-${symbol}`;
                card.innerHTML = `
                    <div class="card-left">
                        <div class="symbol">${symbol}</div>
                        <div class="price">$${item.price}</div>
                        <div class="change ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${item.change_percent}%</div>
                    </div>
                    <div class="sparkline-box">
                        <canvas id="spark-${symbol}"></canvas>
                    </div>
                `;

                card.addEventListener('click', () => {
                    document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    renderSymbolView(symbol);
                });

                container.appendChild(card);
                renderSparkline(symbol, item.sparkline, isPos);
            }

            if (firstSymbol) {
                document.getElementById(`card-${firstSymbol}`).classList.add('active');
                renderSymbolView(firstSymbol);
            }
        });
});

function renderSparkline(symbol, data, isPos) {
    const ctx = document.getElementById(`spark-${symbol}`).getContext('2d');
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
    document.getElementById('chart-title').innerText = `${symbol} - ADVANCED GREEK EXPOSURE PROFILE`;

    const ctx = document.getElementById('strikeChart').getContext('2d');
    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: item.strikes,
            datasets: [
                { label: 'Gamma Exposure (GEX)', data: item.gex, backgroundColor: '#00e676' },
                { label: 'Delta Exposure (DEX)', data: item.dex, backgroundColor: '#00f0ff' },
                { label: 'Vanna Exposure', data: item.vanna, backgroundColor: '#ab47bc' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: '#162032' }, ticks: { color: '#94a3b8' } },
                y: { stacked: true, grid: { color: '#162032' }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#e2e8f0' } } }
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
