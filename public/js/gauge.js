// public/js/gauge.js
document.addEventListener('DOMContentLoaded', () => {
    const gaugeContainer = document.getElementById('risk-gauge');
    if (!gaugeContainer) return; // Stop jika elemen tidak ada (misal di halaman awal)

    const level = gaugeContainer.getAttribute('data-level');
    const prob = gaugeContainer.getAttribute('data-prob');
    
    const gaugeText = document.getElementById('gauge-text');
    const gaugeBar = document.getElementById('gauge-bar');

    // Reset kelas warna dasar
    let wrapperClass = ['bg-gray-50', 'border-gray-200'];
    let textClass = ['text-gray-700'];
    let barClass = ['bg-gray-400'];

    // Logika Penentuan Warna (Sama seperti logika React kamu)
    if (level === 'AMAN') {
        wrapperClass = ['bg-green-100', 'border-green-200'];
        textClass = ['text-green-700'];
        barClass = ['bg-green-500'];
    } else if (level === 'WASPADA') {
        wrapperClass = ['bg-yellow-100', 'border-yellow-200'];
        textClass = ['text-yellow-700'];
        barClass = ['bg-yellow-500'];
    } else if (level === 'BAHAYA') {
        wrapperClass = ['bg-red-100', 'border-red-200'];
        textClass = ['text-red-700'];
        barClass = ['bg-red-600'];
    }

    // Terapkan Kelas ke Elemen
    // 1. Hapus background default, tambah background baru
    gaugeContainer.classList.remove('bg-gray-50'); 
    gaugeContainer.classList.add(...wrapperClass);

    // 2. Warnai Teks
    gaugeText.classList.remove('text-gray-700');
    gaugeText.classList.add(...textClass);

    // 3. Warnai Bar & Set Lebar
    gaugeBar.classList.remove('bg-gray-400');
    gaugeBar.classList.add(...barClass);
    
    // Set width dengan sedikit delay agar animasi transisi jalan
    setTimeout(() => {
        gaugeBar.style.width = `${prob}%`;
    }, 100);
});