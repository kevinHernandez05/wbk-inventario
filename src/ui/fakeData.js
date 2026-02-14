export const dashboardFake = {
  onTimeDelivery: {
    value: 87,
    goal: "-1.2%",
  },

  supply: {
    total: 7842,
    // cada barra: warehouse + transport + retail = 100
    bars: [
      { w: 35, t: 20, r: 45 },
      { w: 55, t: 15, r: 30 },
      { w: 40, t: 25, r: 35 },
      { w: 60, t: 15, r: 25 },
      { w: 45, t: 20, r: 35 },
      { w: 50, t: 20, r: 30 },
      { w: 62, t: 12, r: 26 },
      { w: 58, t: 15, r: 27 },
      { w: 52, t: 20, r: 28 },
      { w: 48, t: 22, r: 30 },
      { w: 44, t: 20, r: 36 },
      { w: 40, t: 18, r: 42 },
    ],
  },

  forecast: {
    previous: 38,
    current: 82,
    bars: [30, 65, 45, 58, 72, 38, 55, 62, 41, 49, 60, 52],
  },

  health: {
    overall: 38,
    over: 12,
    under: 0,
    bars: [
      {
        label: "Healthy",
        note: "Stock estable",
        height: 55,
        base: "bg-cyan-500/80",
      },
      {
        label: "Watchlist",
        note: "Revisar rotación",
        height: 75,
        base: "bg-teal-600/80",
        hatched: true,
      },
      {
        label: "Risk",
        note: "Bajo stock",
        height: 50,
        base: "bg-cyan-500/70",
        hatched: true,
      },
    ],
  },
};
