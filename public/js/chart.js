document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('floodChart');
    
    // Cek jika elemen canvas ada
    if (!ctx) return;

    // Ambil data dari atribut data-json di HTML
    const rawData = JSON.parse(ctx.dataset.json || '[]');

    // Jika data kosong, jangan render error, biarkan kosong atau default
    if (rawData.length === 0) return;

    // Siapkan Label (Jam)
    const labels = rawData.map(d => d.timestamp);
    
    // Siapkan Data
    const rainData = rawData.map(d => d.rainfall_mm);
    const waterData = rawData.map(d => d.water_level_cm);

    new Chart(ctx, {
        type: 'bar', // Kita pakai Bar sebagai dasar agar hujan terlihat batang
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Curah Hujan (mm)',
                    data: rainData,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)', // Biru Solid
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y-hujan', // TERHUBUNG KE SUMBU KIRI
                    type: 'bar', // Hujan bentuknya BATANG
                    order: 2
                },
                {
                    label: 'Tinggi Air (cm)',
                    data: waterData,
                    borderColor: '#ef4444', // Merah
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ef4444',
                    yAxisID: 'y-air', // TERHUBUNG KE SUMBU KANAN
                    type: 'line', // Air bentuknya GARIS
                    tension: 0.4, // Garis melengkung halus
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
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                // Tambahkan satuan di tooltip
                                if(context.dataset.yAxisID === 'y-hujan') label += ' mm';
                                else label += ' cm';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                // KONFIGURASI SUMBU X
                x: {
                    grid: {
                        display: false
                    }
                },
                // KONFIGURASI SUMBU KIRI (HUJAN)
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
                    suggestedMax: 20, // Skala max default agar hujan kecil tetap kelihatan
                    grid: {
                        display: false // Hilangkan grid agar tidak pusing
                    }
                },
                // KONFIGURASI SUMBU KANAN (AIR)
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
                    grid: {
                        drawOnChartArea: true // Grid utama ikut sumbu air saja
                    }
                }
            }
        }
    });
});