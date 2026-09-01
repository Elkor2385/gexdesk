let gexChartInstance = null;
let globalMarketData = {};

document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => response.json())
        .then(result => {
            document.getElementById('last-update').innerText = `Last Updated: ${new Date(result.last_updated).toLocaleTimeString()}`;
            globalMarketData = result.data;
            const grid = document.getElementById('tickers-grid');
            grid.innerHTML = '';

            let firstSymbol = null;
            for (let symbol in globalMarketData) {
                if (!firstSymbol) firstSymbol = symbol;
                const item = globalMarketData[symbol];
                const changeClass = item.change_percent >= 0 ? 'positive' : 'negative';
                const sign = item.change_percent >= 0 ? '+' : '';

                const card = document.createElement('div');
                card.className = 'ticker-card';
                card.id = `card-${symbol}`;
                card.innerHTML = `
                    <div class="ticker-symbol">${symbol}</div>
                    <div class="ticker-price">$${item.price}</div>
                    <div class="${changeClass}">${sign}${item.change_percent}%</div>
                `;
                
                card.addEventListener('click', () => {
                    document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    renderDashboard(symbol);
                });

                grid.appendChild(card);
            }

            // عرض أول تيكر افتراضياً عند فتح الموقع
            if (firstSymbol) {
                document.getElementById(`card-${firstSymbol}`).classList.add('active');
                renderDashboard(firstSymbol);
            }
        })
        .catch(err => console.error('Error loading data.json:', err));
});

function renderDashboard(symbol) {
    const item = globalMarketData[symbol];
    document.getElementById('chart-title').innerText = `${symbol} - GEX & DEX Exposure Profile`;

    // رسم الشارت التفاعلي
    const ctx = document.getElementById('gexChart').getContext('2d');
    if (gexChartInstance) {
        gexChartInstance.destroy();
    }

    gexChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Gamma Exposure (GEX $M)', 'Delta Exposure (DEX $M)'],
            datasets: [{
                label: symbol,
                data: [item.gex || 0, item.dex || 0],
                backgroundColor: [
                    item.gex >= 0 ? '#22c55e' : '#ef4444',
                    '#38bdf8'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: '#1e293b' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    // تحديث قائمة تواريخ الصلاحية (0DTE وغيرها)
    const expBox = document.getElementById('expiration-list');
    let expHtml = `<ul>`;
    if (item.expirations && item.expirations.length > 0) {
        item.expirations.forEach(date => {
            expHtml += `<li>📅 ${date}</li>`;
        });
    } else {
        expHtml += `<li>No active options found</li>`;
    }
    expHtml += `</ul>`;
    expBox.innerHTML = expHtml;
}
