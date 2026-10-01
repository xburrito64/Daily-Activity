import { memo, useContext, useEffect, useMemo } from 'react'
import { formatDuration, formatShortDate, formatDotted, daysBetween, weekdayOf, todayISO } from './time.js'
import { coverUrl } from './api.js'
import { COVER_ASPECT, Covers, coverFor } from './face.js'
import TagIcon from './TagIcon.jsx'
import { Appearance } from './appearance.js'
import { Grimoire } from './scenes/StarParts.jsx'
import { monthByTag } from './scenes/starlit.js'
import {
  PERIOD_KINDS, periodOf, previousOf, stepPeriod, ledgerOf, datesIn, weeksOf, monthShort,
} from './ledger.js'

/** Whole hours, for the big figures: "214h" reads at a glance, "214h 10m" doesn't. */
const hours = (slots) => `${Math.round(slots / 6)}h`

/**
 * The ledger beside the Overview: a stretch of days you choose — the last
 * thirty, a month, a year, or any range — and what was done in it.
 *
 * It used to add up whatever days happened to be on screen, which meant the
 * whole app redrew on almost every frame of scrolling the Overview, and the
 * figures were for a stretch nobody had picked. Now the stretch is chosen
 * here, kept between visits, and the list beside it marks which days are in
 * it. Picking one moves the list to its first day.
 *
 * Blocks are allowed to overlap, so an hour spent gaming while music was on
 * counts towards both tags — the tag hours can add up to more than the days
 * — while the hours logged count each stretch of the day once.
 */
function Totals({ days, tags, ensure, choice, onChoice, onJump, hidden }) {
  const covers = useContext(Covers)
  const { theme } = useContext(Appearance)
  const today = todayISO()
  const period = periodOf(choice, today)
  const before = previousOf(choice, today)

  // The days the figures need, and the stretch before them for comparing.
  useEffect(() => {
    ensure(before.from, period.to)
  }, [ensure, before.from, period.to])

  const now = useMemo(
    () => ledgerOf(days, period.from, period.to, today, (b) => coverFor(b, covers)),
    [days, period.from, period.to, today, covers],
  )
  const then = useMemo(
    () => ledgerOf(days, before.from, before.to, today),
    [days, before.from, before.to, today],
  )

  const pick = (next) => {
    onChoice(next)
    onJump(periodOf(next, today).from)
  }

  const tagById = (id) => tags.find((t) => t.id === id)
  const rows = tags
    .filter((t) => now.slots.get(t.id))
    .map((t) => ({ tag: t, slots: now.slots.get(t.id) }))
    .sort((a, b) => b.slots - a.slots)
  const busiest = rows[0]?.slots ?? 0
  const tagTotal = rows.reduce((sum, r) => sum + r.slots, 0)

  const listOf = (map) => [...map]
    .map(([name, what]) => ({ name, ...what }))
    .sort((a, b) => b.slots - a.slots)

  const current = choice.kind === 'last30'
    || (period.from <= today && today <= period.to)

  return (
    <aside className="ledger" hidden={hidden}>
      <div className="ledgerhead">
        <span className="eyebrow">Ledger of hours</span>

        <div className="ledgertabs" role="group" aria-label="Which days to add up">
          {PERIOD_KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className={choice.kind === kind.id ? 'on' : ''}
              aria-pressed={choice.kind === kind.id}
              onClick={() => pick({ ...choice, kind: kind.id })}
            >
              {kind.name}
            </button>
          ))}
        </div>

        <div className="ledgerperiod">
          {period.steps && (
            <button type="button" className="ledgerstep" aria-label="Earlier" onClick={() => pick(stepPeriod(choice, -1))}>
              <Chevron dir={-1} />
            </button>
          )}
          {choice.kind === 'range' ? (
            <span className="ledgerrange">
              <DateField
                value={choice.from}
                label="From"
                onChange={(from) => pick(from <= choice.to ? { ...choice, from } : { ...choice, from: choice.to, to: from })}
              />
              <span className="ledgerdash">–</span>
              <DateField
                value={choice.to}
                label="To"
                onChange={(to) => pick(to >= choice.from ? { ...choice, to } : { ...choice, from: to, to: choice.from })}
              />
            </span>
          ) : (
            <span className="ledgertitle">{period.title}</span>
          )}
          {period.steps && (
            <button type="button" className="ledgerstep" aria-label="Later" onClick={() => pick(stepPeriod(choice, 1))}>
              <Chevron dir={1} />
            </button>
          )}
        </div>

        <span className="ledgersub">
          {formatShortDate(period.from)} – {formatShortDate(period.to)}
          {' · '}
          {daysBetween(period.from, period.to) + 1} days
          {!current && (choice.kind === 'month' || choice.kind === 'year') && (
            <button type="button" className="ledgernow" onClick={() => pick({ ...choice, at: today })}>
              {choice.kind === 'month' ? 'this month' : 'this year'}
            </button>
          )}
        </span>
      </div>

      {now.counted === 0 ? (
        <p className="totalsempty">These days are still ahead.</p>
      ) : (
        <>
          <div className="ledgerfigures">
            <Figure
              label="Logged"
              value={hours(now.covered)}
              note={now.logged ? `${formatDuration(Math.round(now.covered / now.logged))} a day` : 'nothing yet'}
            />
            <Figure
              label="Days"
              value={<>{now.logged}<small> / {now.counted}</small></>}
              note={now.counted === now.logged ? 'every one written' : `${Math.round((now.logged / now.counted) * 100)}% written`}
            />
            <Figure
              label="Streak"
              value={now.streak ? `${now.streak.length} ${now.streak.length === 1 ? 'day' : 'days'}` : '—'}
              note={now.streak && now.streak.length > 1
                ? `${formatShortDate(now.streak.from)} – ${formatShortDate(now.streak.to)}`
                : ' '}
            />
            <Figure
              label="Fullest"
              value={now.fullest ? formatDuration(now.fullest.covered) : '—'}
              note={now.fullest ? `${weekdayOf(now.fullest.date)} ${formatShortDate(now.fullest.date)}` : ' '}
              onClick={now.fullest ? () => onJump(now.fullest.date) : undefined}
            />
          </div>

          <Calendar ledger={now} from={period.from} to={period.to} today={today} tagById={tagById} onJump={onJump} />

          {now.logged > 0 && <Rhythm rhythm={now.rhythm} tags={tags} />}

          {rows.length === 0 ? (
            <p className="totalsempty">Nothing logged in these days.</p>
          ) : (
            <div className="ledgersection">
              <span className="eyebrow">Hours by tag</span>
              <ul className="totalslist">
                {rows.map(({ tag, slots: amount }) => {
                  // Per logged day, so a month still running is measured
                  // fairly against the whole month before it, and days
                  // nobody wrote down count for neither.
                  const was = then.logged ? (then.slots.get(tag.id) ?? 0) / then.logged : null
                  const is = amount / now.logged
                  const change = was === null ? null : Math.round(is - was)
                  return (
                    <li key={tag.id} className="totalsrow">
                      <span className="totalsname">
                        <TagIcon tag={tag} />
                        <span className="totalslabel">{tag.name}</span>
                        <span className="totalstime">{formatDuration(amount)}</span>
                      </span>
                      <span className="totalsbar">
                        <span
                          className="totalsfill"
                          style={{ width: `${(amount / busiest) * 100}%`, background: tag.colour }}
                        />
                      </span>
                      <span className="totalsavg">
                        <span>
                          {formatDuration(Math.round(amount / Math.max(1, now.logged)))} / logged day
                          {' · '}
                          {Math.round((amount / tagTotal) * 100)}%
                        </span>
                        {change !== null && change !== 0 && (
                          <span
                            className={`totalschange ${change > 0 ? 'up' : 'down'}`}
                            title={`A logged day, against ${formatShortDate(before.from)} – ${formatShortDate(before.to)}`}
                          >
                            {change > 0 ? '▲' : '▼'} {formatDuration(Math.abs(change))}/day
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Under the hours rather than among them: this is the same time
              said again, broken into what it was actually spent on. */}
          <Shelf title="What you played" rows={listOf(now.played)} blank="🎮" />
          <Shelf title="What you watched" rows={listOf(now.watched)} blank="🌸" />
        </>
      )}

      {/* Starlit keeps a grimoire: every tag's rank over the last month,
          whatever stretch the ledger is adding up. */}
      {theme === 'starlit' && <Grimoire month={monthByTag(days, today)} tags={tags} />}
    </aside>
  )
}

// Drawn again only when the days, the tags or the choice change — not on
// every step of zoom or every few rows of scrolling the list beside it.
export default memo(Totals)

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d={dir < 0 ? 'M6.5 1.5 3 5l3.5 3.5' : 'M3.5 1.5 7 5 3.5 8.5'} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A date written out, with the real date field laid over it unseen, as in the header. */
function DateField({ value, label, onChange }) {
  return (
    <label className="ledgerdate" title={label}>
      <span>{formatDotted(value).replaceAll(' · ', '.')}</span>
      <input
        type="date"
        value={value}
        aria-label={label}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
      />
    </label>
  )
}

function Figure({ label, value, note, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`ledgerfigure${onClick ? ' jumps' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="figlabel">{label}</span>
      <span className="figvalue">{value}</span>
      <span className="fignote">{note}</span>
    </Tag>
  )
}

/**
 * The stretch as a calendar: each day tinted with what it was mostly, as
 * deep as it was full. A few weeks are drawn as weeks, with the date in each
 * day; anything longer as a small month for each month, so a whole year
 * still fits beside the list. A day can be clicked to go to it.
 */
function Calendar({ ledger, from, to, today, tagById, onJump }) {
  const byDate = new Map(ledger.days.map((d) => [d.date, d]))
  const cell = (date, numbered) => {
    if (!date) return <span className="calday none" />
    const d = byDate.get(date)
    if (!d) return <span className="calday outside" />
    const tag = d.top ? tagById(d.top) : null
    const full = d.covered ? d.covered / 144 : 0
    const state = d.covered === null ? ' ahead' : d.covered === 0 ? ' empty' : ''
    const title = d.covered === null
      ? `${weekdayOf(date)} ${formatShortDate(date)}`
      : d.covered === 0
        ? `${weekdayOf(date)} ${formatShortDate(date)} · nothing logged`
        : `${weekdayOf(date)} ${formatShortDate(date)} · ${formatDuration(d.covered)} logged · mostly ${tag?.name ?? d.top}`
    return (
      <button
        key={date}
        type="button"
        className={`calday${state}${date === today ? ' today' : ''}`}
        style={tag ? { '--day': tag.colour, '--full': `${Math.round(20 + full * 75)}%` } : undefined}
        title={title}
        onClick={() => onJump(date)}
      >
        {numbered && Number(date.slice(8))}
      </button>
    )
  }

  const dates = datesIn(from, to)
  if (dates.length <= 62) {
    return (
      <div className="ledgersection">
        <div className="calweeks">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="calhead">{d}</span>)}
          {weeksOf(dates).flat().map((date, i) => (
            date ? cell(date, true) : <span key={`n${i}`} className="calday none" />
          ))}
        </div>
      </div>
    )
  }

  // One small month per month the stretch touches, its days outside the
  // stretch left blank.
  const months = []
  for (const date of datesIn(`${from.slice(0, 7)}-01`, to)) {
    if (date.endsWith('-01')) months.push([])
    months[months.length - 1].push(date)
  }
  return (
    <div className="ledgersection">
      <div className="calmonths">
        {months.map((month) => (
          <div key={month[0]} className="calmonth">
            <span className="calmonthname">{monthShort(month[0])}</span>
            <div className="calmini">
              {weeksOf(month).flat().map((date, i) => (
                date && date >= from ? cell(date, false) : <span key={`n${i}`} className="calday none" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A typical day: for each half hour, how often anything was going on then
 * across the days logged, coloured by what it was. Sleep sits along the
 * bottom of the night, the evenings fill with whatever the evenings are for.
 */
function Rhythm({ rhythm, tags }) {
  const bins = rhythm.length
  const nameOf = (id) => tags.find((t) => t.id === id)?.name ?? id
  // One shape per tag, stacked in the order the tags are kept: each half hour
  // a step, as tall as that tag's share of how often anything was on. Drawn
  // as a handful of paths rather than a box per tag per half hour, which was
  // most of the ledger's elements and most of the time it took to open.
  const below = new Array(bins).fill(0)
  const shapes = []
  for (const tag of tags) {
    const share = rhythm.map((bin) => (bin.tags.get(tag.id) ?? 0) * bin.total)
    if (!share.some(Boolean)) continue
    const top = share.map((x, i) => below[i] + x)
    const y = (v) => (100 - v * 100).toFixed(2)
    let d = `M0 ${y(top[0])}`
    for (let i = 0; i < bins; i++) d += `H${i + 1}${i + 1 < bins ? `V${y(top[i + 1])}` : ''}`
    d += `V${y(below[bins - 1])}`
    for (let i = bins - 1; i >= 0; i--) d += `H${i}${i > 0 ? `V${y(below[i - 1])}` : ''}`
    d += 'Z'
    shapes.push(<path key={tag.id} d={d} fill={tag.colour} />)
    top.forEach((v, i) => { below[i] = v })
  }
  return (
    <div className="ledgersection">
      <span className="eyebrow">A typical day</span>
      <svg className="rhythm" viewBox={`0 0 ${bins} 100`} preserveAspectRatio="none">
        {shapes}
        {/* Each half hour, to be pointed at. */}
        {rhythm.map((bin, i) => {
          const top = [...bin.tags].sort((x, y) => y[1] - x[1])[0]
          const at = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
          return (
            <rect key={i} className="rhythmhit" x={i} y="0" width="1" height="100">
              <title>
                {bin.total
                  ? `${at} · something on ${Math.round(bin.total * 100)}% of days · mostly ${nameOf(top[0])}`
                  : `${at} · nothing, usually`}
              </title>
            </rect>
          )
        })}
      </svg>
      <div className="rhythmaxis">
        {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  )
}

/**
 * One list of covers with a name and a total beside each.
 *
 * The same shelf twice: what was played and what was watched are the same
 * kind of answer to the same kind of question, and the day they are drawn
 * differently is the day the ledger stops reading as one page.
 */
function Shelf({ title, rows, blank }) {
  if (rows.length === 0) return null
  return (
    <div className="played">
      <span className="eyebrow">{title}</span>
      <ul className="playedlist">
        {rows.map((row) => (
          <li key={row.name} className="playedrow">
            {row.cover
              ? (
                <img
                  className="playedcover"
                  style={{ '--cover-aspect': COVER_ASPECT }}
                  src={coverUrl(row.cover)}
                  alt=""
                  loading="lazy"
                />
              )
              : <span className="playedcover none" aria-hidden="true">{blank}</span>}
            <span className="playedname">{row.name}</span>
            <span className="playedtime">
              {formatDuration(row.slots)}
              {row.episodes > 0 && (
                <b className="playedeps">
                  {row.episodes} ep{row.episodes === 1 ? '' : 's'}
                </b>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
