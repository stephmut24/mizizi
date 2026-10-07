import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useNotebook } from '../api/notebook';
import { Icon, type IconName } from './Icon';

const tabs: { path: string; label: string; icon: IconName }[] = [
  { path: '/herbarium', label: 'Herbarium', icon: 'book' },
  { path: '/walks', label: 'Walks', icon: 'walk' },
  { path: '/people', label: 'People', icon: 'people' },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { notice, announce } = useNotebook();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('notebook-main')?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <>
      <a
        className="skip-link"
        href="#notebook-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('notebook-main')?.focus();
        }}
      >
        Skip to notebook
      </a>
      <header className="topbar">
        <div className="shell-width topbar-inner">
          <Link className="brand" to="/herbarium" aria-label="Mizizi herbarium">
            <Icon name="leaf" size={27} />
            <span>Mizizi</span>
          </Link>
          <span className="mobile-mark" aria-hidden="true">
            <Icon name="book" />
          </span>
          <nav className="main-nav" aria-label="Main navigation">
            {tabs.map((tab) => (
              <NavLink key={tab.path} to={tab.path}>
                <Icon name={tab.icon} size={23} />
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="notebook-main"
        className="shell-width notebook-main"
        tabIndex={-1}
      >
        {notice && (
          <div className="success-banner" role="status">
            <Icon name="check" />
            <span>{notice}</span>
            <button
              className="icon-button"
              onClick={() => announce('')}
              aria-label="Dismiss notification"
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {children}
      </main>
      <footer className="notebook-footer">
        Use this before and after your walk, not during it.
      </footer>
    </>
  );
}
