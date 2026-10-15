import { createRouter } from '@solidjs/router';
import { lazy } from 'solid-js';
import { DOC_ROUTES } from './lib/docs';
import Home from './pages/Home';

export const Router = createRouter({
  routes: [
    { path: '/', component: Home },
    ...DOC_ROUTES,
    {
      path: '/playground',
      component: lazy(() => import('./pages/Playground')),
    },
    { path: '*404', component: lazy(() => import('./pages/NotFound')) },
  ],
});
