import { useEffect, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import { seasons, weathers } from './world/config';
import type { Environment, Season, Weather } from './world/config';
import type { NatureWorld } from './world/NatureWorld';

type IconName = Season | Weather;

function NatureIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {(name === 'sunny' || name === 'summer') && <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>}
      {name === 'spring' && <>
        <path d="M12 21V10m0 7C5.5 17 4 13.5 4 9c4.5 0 8 2 8 6m0-2c0-5.5 3-8 8-8 0 5-2.5 8-8 8Z" />
        <path d="m8 13 4 4m0-4 4-4M10 5.5c0-1.5 2-3.5 2-3.5s2 2 2 3.5a2 2 0 0 1-4 0Z" />
      </>}
      {name === 'autumn' && <>
        <path d="M12 22v-7M12 2l2.3 5 3.2-2-.5 4.8 4 1.2-4.2 4.3.7 3.2-5.5-1.7-5.5 1.7.7-3.2L3 11l4-1.2-.5-4.8 3.2 2L12 2Z" />
        <path d="m8.5 11.5 3.5 3.8 3.5-3.8" />
      </>}
      {name === 'winter' && <>
        <path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M3.5 10.4l4.1-1.1-1.1-4.1M17.5 18.8l-1.1-4.1 4.1-1.1M6.5 18.8l1.1-4.1-4.1-1.1M20.5 10.4l-4.1-1.1 1.1-4.1" />
      </>}
      {(name === 'cloudy' || name === 'rainy') && <>
        <path d="M6.2 16.5a4.2 4.2 0 1 1 .8-8.32 5.7 5.7 0 0 1 10.96 1.35A3.5 3.5 0 1 1 18 16.5H6.2Z" />
        {name === 'rainy' && <path d="m8 19-.7 2m5.2-2-.7 2m5.2-2-.7 2" />}
      </>}
    </svg>
  );
}

export default function App() {
  const [environment, setEnvironment] = useState<Environment>({ season: 'spring', weather: 'sunny' });
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [credits, setCredits] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<NatureWorld | null>(null);
  const environmentRef = useRef(environment);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: NatureWorld | null = null;
    const element = host.current;
    if (!element) return;

    async function initialize() {
      const [{ NatureWorld: World }, { loadWorldTextures }] = await Promise.all([
        import('./world/NatureWorld'), import('./world/textures'),
      ]);
      if (cancelled) return;
      const textures = await loadWorldTextures();
      if (cancelled) {
        Object.values(textures).forEach(texture => texture.dispose());
        return;
      }
      try {
        instance = new World(element!, textures, value => { if (!cancelled) setReady(value); });
        instance.setEnvironment(environmentRef.current);
        world.current = instance;
      } catch (error) {
        Object.values(textures).forEach(texture => texture.dispose());
        element!.replaceChildren();
        setFailed(true);
        console.warn('The interactive scene needs a WebGL 2 capable browser.', error);
      }
    }

    initialize().catch(error => { setFailed(true); console.warn('Could not initialize the nature scene.', error); });
    return () => {
      cancelled = true;
      instance?.dispose();
      world.current = null;
    };
  }, []);

  useEffect(() => {
    environmentRef.current = environment;
    world.current?.setEnvironment(environment);
  }, [environment]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus(), 60);
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLButtonElement>('button')];
        const current = document.activeElement;
        if ((!event.shiftKey && current === items[items.length - 1]) || (event.shiftKey && current === items[0])) {
          event.preventDefault();
          trigger.current?.focus();
          setOpen(false);
        }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'h' && !event.repeat) setHidden(value => !value);
      if (event.key === 'Escape') setCredits(false);
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setNotice('Fullscreen is unavailable in this browser.'); }
  }

  const currentSeason = seasons.find(season => season.id === environment.season)!;
  const currentWeather = weathers.find(weather => weather.id === environment.weather)!;
  const weatherLabel = environment.season === 'winter' && environment.weather === 'rainy' ? 'Snow' : currentWeather.label;

  return (
    <main className={`nature-stage${ready ? ' is-ready' : ''}`} data-season={environment.season} data-weather={environment.weather}>
      <div className="world-preview" aria-hidden="true">
        <img src="/sanctuary.jpg" alt="" className="world-poster" fetchPriority="high" draggable={false} />
      </div>
      <div className="scene-surface" ref={host} />
      {!hidden && <header className="dream-header">
        <div className="pixtra-brand"><span className="brand-mark">p<span>✦</span></span><span>PIXTRA <small>INTERACTIVE</small></span></div>
        <div className="header-actions"><button onClick={() => setCredits(true)}>Credits</button><button onClick={fullscreen}>Fullscreen</button>{started && <button onClick={() => setHidden(true)}>Hide UI <kbd>H</kbd></button>}</div>
      </header>}
      {!started && <section className="dream-intro" aria-labelledby="dream-title">
        <p className="eyebrow">A LITTLE WORLD. A MOMENT AWAY.</p>
        <h1 id="dream-title">DREAMSCAPE</h1>
        <p className="intro-subtitle">An Interactive World Experience</p>
        <p className="intro-copy">A lakeside cabin. A thousand quiet details.<br />Find your own season of stillness.</p>
        <button className="explore-button" disabled={!ready || failed} onClick={() => { setStarted(true); host.current?.querySelector('canvas')?.focus(); }}>{failed ? 'WebGL 2 required' : ready ? 'Start Exploring' : 'Preparing your world…'}<span aria-hidden="true">↗</span></button>
        <p className="intro-note">{failed ? 'Enable hardware acceleration, then refresh to try again.' : 'Drag to orbit · Scroll to get closer · No download needed'}</p>
        <span className="scene-number">01 / THE ALPINE SANCTUARY</span>
      </section>}
      {started && !hidden && <><div className="scene-label"><span className="eyebrow">DREAMSCAPE</span><p>The Alpine Sanctuary</p></div><div className="camera-guide">Drag to orbit <span>·</span> Right-drag to pan <span>·</span> Scroll to zoom<br /><small>Double-click to reset · Arrow keys to orbit · + / − to zoom</small></div></>}
      {hidden && <button className="restore-ui" aria-label="Show interface" onClick={() => setHidden(false)}>Show UI <kbd>H</kbd></button>}
      {notice && <button className="dream-notice" onClick={() => setNotice('')} role="status">{notice} ×</button>}
      {credits && <div className="credits-shade" onClick={() => setCredits(false)}><section className="credits-card" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={event => event.stopPropagation()}><p className="eyebrow">THE PEOPLE BEHIND THE WORLD</p><h2 id="credits-title">A shared creation.</h2><p>Adapted by Pixtra Interactive from <strong>Stillwild</strong>, part of greenwoodpro’s Astra 3D Mini Worlds, generated with Astra on Arena.ai.</p><p>Original scene and rendering © 2026 greenwoodpro, MIT. Pixtra added presentation, English controls, fullscreen, and interface controls.</p><a href="https://github.com/greenwoodpro/astra-3d-mini-worlds" target="_blank" rel="noreferrer">Explore the original source ↗</a><button autoFocus onClick={() => setCredits(false)} aria-label="Close credits">Back to the world</button></section></div>}
      {started && !hidden && <div className="environment-control">
        {open && (
          <div className="environment-panel" ref={panel} id="environment-panel" role="dialog" aria-label={'Seasons and weather'}>
            <div className="control-section">
              <h2 className="section-caption">{'SEASON'}</h2>
              <div className="season-options" role="group" aria-label={'Choose season'}>
                {seasons.map(season => (
                  <button key={season.id} type="button" className="environment-option season-option" aria-pressed={environment.season === season.id}
                    onClick={() => setEnvironment(previous => ({ ...previous, season: season.id }))}>
                    <NatureIcon name={season.id} />
                    <span>{season.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="control-divider" />
            <div className="control-section">
              <h2 className="section-caption">{'WEATHER'}</h2>
              <div className="weather-options" role="group" aria-label={'Choose weather'}>
                {weathers.map(weather => (
                  <button key={weather.id} type="button" className="environment-option weather-option" aria-pressed={environment.weather === weather.id}
                    onClick={() => setEnvironment(previous => ({ ...previous, weather: weather.id }))}>
                    <NatureIcon name={weather.id === 'rainy' && environment.season === 'winter' ? 'winter' : weather.id} />
                    <span>{weather.id === 'rainy' && environment.season === 'winter' ? 'Snow' : weather.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <button type="button" ref={trigger} className={`environment-trigger${open ? ' is-open' : ''}`} aria-expanded={open}
          aria-controls="environment-panel" aria-haspopup="dialog"
          aria-label={`${currentSeason.label}, ${weatherLabel}. Change season and weather`}
          onClick={() => setOpen(previous => !previous)}>
          <NatureIcon className="trigger-icon" name={environment.weather === 'sunny' ? environment.season : environment.weather === 'rainy' && environment.season === 'winter' ? 'winter' : environment.weather} />
          <span className="trigger-label">{currentSeason.short}<span className="label-dot" aria-hidden="true" />{weatherLabel}</span>
          <svg className="trigger-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 9 3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>}
    </main>
  );
}
