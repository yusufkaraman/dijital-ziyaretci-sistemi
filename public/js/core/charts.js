// ── Shared Chart Core ────────────────────────────────────
let weeklyChart = null;

function drawTrafficChart(data) {
  console.log('Grafik ciziliyor, veri:', data);
  const canvas = document.getElementById('weeklyTrafficChart') || document.getElementById('trafficChart');
  if (!canvas) {
    console.warn('Grafik canvasi bulunamadi!');
    return;
  }
  const ctx = canvas.getContext('2d');

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js kutuphanesi yuklenemedi.');
    return;
  }

  const labels = (data && Array.isArray(data.days)) ? data.days : [];
  const entryData = (data && Array.isArray(data.entries)) ? data.entries : [];
  const appointmentData = (data && Array.isArray(data.appointments)) ? data.appointments : [];
  const fallbackExitData = (data && Array.isArray(data.exits)) ? data.exits : [];
  const secondaryData = appointmentData.length ? appointmentData : fallbackExitData;
  const secondaryLabel = appointmentData.length ? 'Randevular' : 'Ayrilanlar';

  const entryGradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 320);
  entryGradient.addColorStop(0, 'rgba(0, 96, 240, 0.28)');
  entryGradient.addColorStop(1, 'rgba(0, 96, 240, 0.03)');

  const secondaryGradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 320);
  secondaryGradient.addColorStop(0, 'rgba(14, 165, 233, 0.24)');
  secondaryGradient.addColorStop(1, 'rgba(14, 165, 233, 0.03)');

  if (weeklyChart) {
    weeklyChart.destroy();
  }

  try {
    weeklyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Giris Yapanlar',
            data: entryData,
            borderColor: '#0060f0',
            backgroundColor: entryGradient,
            borderWidth: 3,
            tension: 0.38,
            fill: true,
            pointBackgroundColor: '#0060f0',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 2,
            pointRadius: 4
          },
          {
            label: secondaryLabel,
            data: secondaryData,
            borderColor: '#0ea5e9',
            backgroundColor: secondaryGradient,
            borderWidth: 3,
            tension: 0.38,
            fill: true,
            pointBackgroundColor: '#0ea5e9',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 2,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'start',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              boxHeight: 10,
              padding: 18,
              color: '#0f172a',
              font: { family: 'Noto Sans', size: 12, weight: '700' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            cornerRadius: 14,
            padding: 12,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13 },
            displayColors: true,
            caretPadding: 10
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: 'rgba(148,163,184,0.16)', drawBorder: false },
            border: { display: false },
            ticks: {
              stepSize: 1,
              color: '#64748b',
              padding: 8,
              font: { family: 'Noto Sans', size: 11, weight: '600' }
            }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 0,
              color: '#64748b',
              padding: 10,
              font: { family: 'Noto Sans', size: 10, weight: '600' }
            }
          }
        }
      }
    });
    console.log('Grafik basariyla olusturuldu.');
  } catch (err) {
    console.error('Grafik olusturulurken hata:', err);
  }
}
