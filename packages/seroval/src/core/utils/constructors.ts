
export function createResponseOptions(
  current: Response,
): ResponseInit {
  return {
    headers: current.headers,
    status: current.status,
    statusText: current.statusText,
  };
}

