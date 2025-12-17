// public/js/chart.js
document.addEventListener("DOMContentLoaded", function() {
    const canvas = document.getElementById('floodChart');
    if (!canvas) return; // Stop jika tidak ada chart

    const ctx = canvas.getContext('2d');
    
    // Ambil data dari atribut HTML
    const rawData = canvas.getAttribute('data-json');
    let sensorData = [];

    try {
        sensorData = JSON.parse(rawData);
    } catch (e) {
        console.error("Error parsing chart data", e);
    }
    
    if (sensorData && sensorData.length > 0) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: sensorData.map(d => d.timestamp),
                datasets: [
                    {
                        label: 'Curah Hujan (mm)',
                        data: sensorData.map(d => d.rainfall_mm),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Tinggi Air (cm)',
                        data: sensorData.map(d => d.water_level_cm),
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    } else {
        console.warn("Data sensor kosong.");
    }
});