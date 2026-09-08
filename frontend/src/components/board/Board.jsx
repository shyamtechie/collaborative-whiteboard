import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { ReactSketchCanvas } from 'react-sketch-canvas';

import './style.css';

const Board = forwardRef((props, ref) => {
  const canvasRef = useRef(null);

  const isApplyingRemoteChange = useRef(false);

  const handleStroke = (path, isEraser) => {
    console.log('========== STROKE ==========');

    console.log('Path:', path);

    console.log('Is eraser:', isEraser);

    if (isApplyingRemoteChange.current) {
      console.log('Ignoring remotely loaded stroke');

      return;
    }

    if (props.onDraw) {
      console.log(
        isEraser ? 'Sending eraser stroke' : 'Sending drawing stroke',
      );

      props.onDraw(path, isEraser);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      /*
       * Load paths received from
       * another user/server.
       */
      loadPaths: (paths) => {
        if (!canvasRef.current) {
          return;
        }

        isApplyingRemoteChange.current = true;

        console.log('Loading paths from server:', paths);

        canvasRef.current.loadPaths(paths);

        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 0);
      },

      /*
       * Clear the entire canvas.
       */
      clearCanvas: () => {
        if (!canvasRef.current) {
          return;
        }

        isApplyingRemoteChange.current = true;

        canvasRef.current.clearCanvas();

        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 0);
      },

      /*
       * Reset the canvas.
       */
      resetCanvas: () => {
        if (!canvasRef.current) {
          return;
        }

        isApplyingRemoteChange.current = true;

        canvasRef.current.resetCanvas();

        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 0);
      },

      /*
       * Enable / disable eraser mode.
       */
      eraseMode: (enabled) => {
        if (!canvasRef.current) {
          return;
        }

        canvasRef.current.eraseMode(enabled);
      },

      /*
       * Export the current whiteboard
       * as a PNG data URL.
       *
       * This is used by the AI assistant.
       */
      exportImage: async () => {
        if (!canvasRef.current) {
          return null;
        }

        try {
          const image = await canvasRef.current.exportImage('png');

          console.log('Whiteboard image exported for AI');

          return image;
        } catch (error) {
          console.error('Could not export whiteboard:', error);

          return null;
        }
      },
    }),
    [],
  );

  return (
    <ReactSketchCanvas
      ref={canvasRef}
      className="whiteboard-canvas"
      strokeColor={props.strokeColor}
      strokeWidth={props.strokeWidth}
      eraserWidth={props.eraserWidth}
      canvasColor="white"
      width="100%"
      height="100%"
      onStroke={handleStroke}
    />
  );
});

export default Board;
