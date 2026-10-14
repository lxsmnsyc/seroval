import { httpStatus } from '@solidjs/web';
import PageMeta from '../components/PageMeta';

export default function NotFound() {
  httpStatus(404);
  return (
    <div class="not-found">
      <PageMeta title="Page not found" description="This page does not exist." />
      <h1>Page not found</h1>
      <p>
        This page does not exist. Go back to the <a href="/">home page</a>.
      </p>
    </div>
  );
}
