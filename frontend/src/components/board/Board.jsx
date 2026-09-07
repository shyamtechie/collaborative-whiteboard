import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { ReactSketchCanvas } from 'react-sketch-canvas';

import './style.css';

const Board = forwardRef((props, ref) => {
  const canvasRef = useRef(null);

  /*
   * When we receive drawing data from another user,
   * react-sketch-canvas may trigger onStroke again.
   *
   * This flag prevents that remote stroke from being
   * sent back to the server.
   */
  const isApplyingRemoteChange = useRef(false);

  /*
   * Called whenever the current user draws or erases.
   */
  const handleStroke = (path, isEraser) => {
    console.log('========== STROKE ==========');
    console.log('Original path:', path);
    console.log('Is eraser:', isEraser);

    /*
     * Ignore strokes generated while we are loading
     * remote/server data.
     */
    if (isApplyingRemoteChange.current) {
      console.log('Ignoring remotely loaded stroke');

      return;
    }

    /*
     * Make sure the stroke is valid.
     */
    if (!path || !Array.isArray(path.paths)) {
      console.log('Invalid stroke received');

      return;
    }

    /*
     * IMPORTANT:
     *
     * Convert the canvas path into a completely
     * plain JSON-safe object.
     *
     * This prevents Socket.IO's hasBinary()
     * recursion problem.
     */
    const safeStroke = {
      paths: path.paths.map((point) => ({
        x: Number(point.x),
        y: Number(point.y),
      })),

      strokeWidth: Number(path.strokeWidth),

      strokeColor: String(path.strokeColor),

      drawMode: Boolean(path.drawMode),
    };

    console.log('Safe stroke:', safeStroke);

    /*
     * Send the clean stroke to Container.
     */
    if (props.onDraw) {
      if (isEraser) {
        console.log('Sending eraser stroke');
      } else {
        console.log('Sending drawing stroke');
      }

      props.onDraw(safeStroke, Boolean(isEraser));
    }
  };

  /*
   * Expose functions to Container.jsx.
   */
  useImperativeHandle(
    ref,
    () => ({
      /*
       * Load paths received from the server.
       */
      loadPaths: (paths) => {
        if (!canvasRef.current) {
          return;
        }

        isApplyingRemoteChange.current = true;

        console.log('Loading paths from server:', paths);

        canvasRef.current.loadPaths(paths);

        /*
         * Give react-sketch-canvas enough
         * time to finish firing callbacks.
         */
        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 50);
      },

      /*
       * Clear the canvas.
       */
      clearCanvas: () => {
        if (!canvasRef.current) {
          return;
        }

        isApplyingRemoteChange.current = true;

        canvasRef.current.clearCanvas();

        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 50);
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
        }, 50);
      },

      /*
       * Enable or disable eraser mode.
       */
      eraseMode: (enabled) => {
        if (!canvasRef.current) {
          return;
        }

        canvasRef.current.eraseMode(enabled);
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
