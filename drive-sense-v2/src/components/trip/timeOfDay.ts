/** "8:19 pm" style clock time for the trip page. */
export const clockTime = (at: number | string) => new Date(at).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'});
