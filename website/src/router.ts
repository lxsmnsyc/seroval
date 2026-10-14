import { createRouter } from '@solidjs/router';
import { lazy } from 'solid-js';
import { DOCS } from './docs';
import Home from './pages/Home';

export const Router = createRouter({
  routes: [
    { path: '/', component: Home },
    ...DOCS.map(entry => ({
      path: `/docs/${entry.slug}`,
      component: entry.page,
    })),
    {
      path: '/playground',
      component: lazy(() => import('./pages/Playground')),
    },
    { path: '*404', component: lazy(() => import('./pages/NotFound')) },
  ],
});
