window.SGM = {
  chart(canvasId, labels, values, label, color = '#183b73') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          backgroundColor: color || '#183b73',
          borderRadius: 7,
          borderSkipped: false,
          maxBarThickness: 72
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(24, 59, 115, 0.12)'
            },
            ticks: {
              color: '#475467'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#475467'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              boxWidth: 32,
              color: '#344054'
            }
          }
        }
      }
    });
  }
};
