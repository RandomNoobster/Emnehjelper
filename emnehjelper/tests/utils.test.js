import { mergeData } from '../emnehjelper/utils';

test('mergeData should correctly merge data from emnr and karakterweb', () => {
  const emnrData = { /* mock data */ };
  const karakterwebData = { /* mock data */ };
  const result = mergeData(emnrData, karakterwebData);
  expect(result).toEqual({ /* expected result */ });
});