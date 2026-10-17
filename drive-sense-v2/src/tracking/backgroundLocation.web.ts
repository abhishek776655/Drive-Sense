/** No background location on web. */
export const backgroundSupported = (): boolean => false;
export const startBackgroundLocation = async (): Promise<boolean> => false;
export const stopBackgroundLocation = async (): Promise<void> => undefined;
export function useBackgroundLocation(): void {}
