// A fixed magnitude scale makes colours comparable across poses. The sign is
// represented separately by the bar direction and the printed value.
const YamTorqueHeat = (() => {
  const max = 16;
  const stops = [
    [0, [91, 159, 232]],
    [0.15, [115, 194, 235]],
    [0.35, [239, 183, 116]],
    [0.65, [240, 130, 97]],
    [1, [227, 81, 88]],
  ];
  function rgb(torque) {
    const t = Math.min(1, Math.abs(torque) / max);
    for (let i = 1; i < stops.length; i++) {
      const [end, b] = stops[i];
      if (t <= end) {
        const [start, a] = stops[i - 1], weight = (t - start) / (end - start);
        return a.map((channel, k) => Math.round(channel + (b[k] - channel) * weight));
      }
    }
    return stops.at(-1)[1];
  }
  const css = torque => `rgb(${rgb(torque).join(',')})`;
  return { max, rgb, css };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = YamTorqueHeat;
