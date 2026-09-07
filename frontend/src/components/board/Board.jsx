import React, { forwardRef } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';

const Board = forwardRef((props, ref) => {
	console.log('BOARD COMPONENT LOADED');

	const handleStroke = (path, isEraser) => {
		console.log('========== STROKE ==========');
		console.log('Path:', path);
		console.log('Is eraser:', isEraser);

		if (isEraser) {
			return;
		}

		if (props.onDraw) {
			console.log('Sending stroke to Container');
			props.onDraw(path);
		}
	};

	return (
		<ReactSketchCanvas
			ref={ref}
			strokeColor={props.strokeColor}
			strokeWidth={props.strokeWidth}
			canvasColor="white"
			width="100%"
			height="100%"
			onStroke={handleStroke}
		/>
	);
});

export default Board;
