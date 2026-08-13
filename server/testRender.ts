import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { defaultSampleProjectJson } from '../src/remotion/Root';

async function testRender() {
  console.log('Starting Remotion render test...');

  const entryPoint = path.resolve('./src/remotion/index.ts');
  console.log('Bundling Remotion entry point:', entryPoint);

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config
  });

  console.log('Bundle created at:', bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'JoelizerVideo',
    inputProps: {
      projectJson: defaultSampleProjectJson
    }
  });

  console.log('Composition selected:', composition.id, `${composition.width}x${composition.height}`, `${composition.durationInFrames} frames`);

  const outputLocation = path.resolve('./test-output.mp4');

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    outputLocation,
    inputProps: {
      projectJson: defaultSampleProjectJson
    },
    codec: 'h264',
    onProgress: ({ progress }) => {
      console.log(`Render progress: ${(progress * 100).toFixed(1)}%`);
    }
  });

  console.log('Render test complete! Output file:', outputLocation, 'Size:', fs.statSync(outputLocation).size, 'bytes');
}

testRender().catch((err) => {
  console.error('Render test failed with error:', err);
  process.exit(1);
});
