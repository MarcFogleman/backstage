/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { clampZoomTransform } from './clampZoomTransform';

describe('clampZoomTransform', () => {
  const dimensions = { maxWidth: 400, maxHeight: 200 };

  it('keeps a transform that is within bounds', () => {
    expect(clampZoomTransform({ x: -100, y: -50, k: 2 }, dimensions)).toEqual({
      x: -100,
      y: -50,
    });
  });

  it('does not allow panning past the top left corner', () => {
    expect(clampZoomTransform({ x: 10, y: 20, k: 2 }, dimensions)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('does not allow panning past the bottom right corner', () => {
    expect(
      clampZoomTransform({ x: -1000, y: -1000, k: 2 }, dimensions),
    ).toEqual({ x: -400, y: -200 });
  });

  it('pulls a transform back into view when the graph shrinks', () => {
    const transform = { x: -600, y: -300, k: 2 };
    expect(
      clampZoomTransform(transform, { maxWidth: 800, maxHeight: 400 }),
    ).toEqual({ x: -600, y: -300 });
    expect(clampZoomTransform(transform, dimensions)).toEqual({
      x: -400,
      y: -200,
    });
  });
});
