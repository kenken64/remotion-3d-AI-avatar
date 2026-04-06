import React from 'react';
import {Composition} from 'remotion';
import {AvatarComposition} from './AvatarComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Avatar"
        component={AvatarComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          text: 'Hello, welcome to my channel! I am your cartoon avatar and I can lip sync to any text you type.',
        }}
      />
    </>
  );
};
