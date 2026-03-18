import { forceUiRefresh } from './forceUiRefresh';

export const afterMutationRefresh = async () => {
  forceUiRefresh();

  requestAnimationFrame(() => {
    forceUiRefresh();
  });

  setTimeout(() => {
    forceUiRefresh();
  }, 20);

  setTimeout(() => {
    forceUiRefresh();
  }, 80);
};