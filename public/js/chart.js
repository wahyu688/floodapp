document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('floodChart');
    if (!ctx) return;

    const rawData = JSON.parse(ctx.dataset.json || '[]');
    if (rawData.length === 0) return;

    const labels = rawData.map(d => d.timestamp);
    const rainData = rawData.map(d => d.rainfall_mm);
    const waterData = rawData.map(d => d.water_level_cm);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Curah Hujan (mm)',
                    data: rainData,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y-hujan',
                    type: 'bar',
                    order: 2,
                    barPercentage: 0.6 // Bikin batang lebih gemuk sedikit
                },
                {
                    label: 'Tinggi Air (cm)',
                    data: waterData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ef4444',
                    yAxisID: 'y-air',
                    type: 'line',
                    tension: 0.4,
                    fill: true,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                if(context.dataset.yAxisID === 'y-hujan') label += ' mm';
                                else label += ' cm';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                // --- PENGATURAN SKALA HUJAN (KIRI) ---
                'y-hujan': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Curah Hujan (mm)',
                        color: '#3b82f6',
                        font: { weight: 'bold' }
                    },
                    min: 0,
                    // REVISI: Ganti suggestedMax dari 20 jadi 1.0 saja
                    // Ini membuat hujan 0.2mm akan terlihat setinggi 20% grafik (Jelas terlihat)
                    // Jika hujan deras (>1mm), grafik akan otomatis menyesuaikan (naik sendiri)
                    suggestedMax: 1.0, 
                    grid: { display: false }
                },
                // --- PENGATURAN SKALA AIR (KANAN) ---
                'y-air': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Tinggi Air (cm)',
                        color: '#ef4444',
                        font: { weight: 'bold' }
                    },
                    min: 0,
                    suggestedMax: 100, // Skala air tetap besar
                    grid: { drawOnChartArea: true }
                }
            }
        }
    });
});