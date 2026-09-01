document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => response.json())
        .then(result => {
            document.getElementById('last-update').innerText = `Last Updated: ${new Date(result.last_updated).toLocaleTimeString()}`;
            const grid = document.getElementById('tickers-grid');
            grid.innerHTML = '';

            const data = result.data;
            for (let symbol in data) {
                const item = data[symbol];
                const changeClass = item.change_percent >= 0 ? 'positive' : 'negative';
                const sign = item.change_percent >= 0 ? '+' : '';

                const card = document.createElement('div');
                card.className = 'ticker-card';
                card.innerHTML = `
                    <div class="ticker-symbol">${symbol}</div>
                    <div class="ticker-price">$${item.price}</div>
                    <div class="${changeClass}">${sign}${item.change_percent}%</div>
                `;
                
                card.addEventListener('click', () => {
                    showDetails(symbol, item);
                });

                grid.appendChild(card);
            }
        })
        .catch(err => console.error('Error loading data.json:', err));
});

function showDetails(symbol, item) {
    const expBox = document.getElementById('expiration-list');
    let expHtml = `<strong>${symbol} Expirations (0DTE & Near):</strong><ul>`;
    item.expirations.forEach(date => {
        expHtml += `<li>${date}</li>`;
    });
    expHtml += `</ul>`;
    expBox.innerHTML = expHtml;
}
