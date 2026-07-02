import React from 'react';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { T, rgba } from '../theme';
import { CATS, SCHEDULE, dur, isActive } from '../data';

const C = 180;
const R_OUT = 132;
const R_IN = 100;
const GAP = 0.7; // セグメント間の角度ギャップ(≈2px)

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

function arcPath(rO, rI, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(rO, a0);
  const [x1, y1] = polar(rO, a1);
  const [x2, y2] = polar(rI, a1);
  const [x3, y3] = polar(rI, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${rO} ${rO} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${rI} ${rI} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

const toDeg = (m) => (m / 1440) * 360;

// 日付またぎを分割してチャート用セグメントに
function chartSegments() {
  const segs = [];
  for (const e of SCHEDULE) {
    if (e.start < e.end) segs.push({ ...e, s: e.start, t: e.end });
    else {
      segs.push({ ...e, s: e.start, t: 1440 });
      segs.push({ ...e, s: 0, t: e.end, wrapped: true });
    }
  }
  return segs;
}

export default function Clock24({ now, onSelect }) {
  const segs = chartSegments();
  const cur = SCHEDULE.find((e) => isActive(e, now));
  const nd = toDeg(now);
  const [nx0, ny0] = polar(R_IN - 2, nd);
  const [nx1, ny1] = polar(R_OUT + 9, nd);

  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const deg = toDeg(h * 60);
    const major = h % 6 === 0;
    const [x0, y0] = polar(R_IN - 6, deg);
    const [x1, y1] = polar(R_IN - (major ? 14 : 10), deg);
    ticks.push({ h, major, x0, y0, x1, y1, label: major ? polar(R_IN - 24, deg) : null });
  }

  return (
    <Svg viewBox="22 22 316 316" width="100%" height="100%">
      {/* 背景リング */}
      <Circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none" stroke={T.surface2} strokeWidth={R_OUT - R_IN} />

      {/* セグメント */}
      {segs.map((sg, i) => {
        const a0 = toDeg(sg.s) + GAP / 2;
        const a1 = toDeg(sg.t) - GAP / 2;
        if (a1 <= a0) return null;
        const active = isActive(sg, now);
        const done = !active && sg.t <= now;
        return (
          <React.Fragment key={sg.id + i}>
            {active && (
              <Path d={arcPath(R_OUT + 10, R_IN - 6, a0 - 0.6, a1 + 0.6)} fill={rgba(CATS[sg.cat].hex, 0.22)} />
            )}
            <Path
              d={arcPath(active ? R_OUT + 5 : R_OUT, active ? R_IN - 2 : R_IN, a0, a1)}
              fill={CATS[sg.cat].hex}
              opacity={done ? 0.5 : 1}
              onPress={onSelect ? () => onSelect(sg.id) : undefined}
            />
          </React.Fragment>
        );
      })}

      {/* セグメント上のアイコンと時間ラベル */}
      {segs.map((sg, i) => {
        if (sg.wrapped) return null;
        const span = dur(sg);
        const midDeg = toDeg((sg.start + span / 2) % 1440);
        const rMid = (R_OUT + R_IN) / 2;
        const [ix, iy] = polar(rMid, midDeg);
        const [lx, ly] = polar(R_OUT + 14, midDeg);
        return (
          <React.Fragment key={'lb' + sg.id + i}>
            {span >= 45 && (
              <SvgText x={ix} y={iy + 5} fontSize={14} textAnchor="middle">
                {CATS[sg.cat].icon}
              </SvgText>
            )}
            {span >= 120 && (
              <SvgText x={lx} y={ly + 3.5} fontSize={10} fontWeight="700" fill={T.ink2} textAnchor="middle">
                {(span / 60).toFixed(span % 60 ? 1 : 0)}h
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {/* 時間目盛り(6時間ごとに強調+ラベル) */}
      {ticks.map((t) => (
        <React.Fragment key={'t' + t.h}>
          <Line x1={t.x0} y1={t.y0} x2={t.x1} y2={t.y1} stroke={t.major ? T.ink3 : T.line} strokeWidth={t.major ? 2 : 1} />
          {t.label && (
            <SvgText x={t.label[0]} y={t.label[1] + 3.5} fontSize={10} fill={T.ink3} textAnchor="middle">
              {t.h}
            </SvgText>
          )}
        </React.Fragment>
      ))}

      {/* 現在時刻の針 */}
      <Line x1={nx0} y1={ny0} x2={nx1} y2={ny1} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.95} />
      <Circle cx={nx1} cy={ny1} r={4.5} fill="#fff" />
      {cur && <Circle cx={nx1} cy={ny1} r={8} fill="none" stroke={CATS[cur.cat].hex} strokeWidth={2} />}
    </Svg>
  );
}
