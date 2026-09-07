import React from 'react';
import './JoinScreen.css';

class JoinScreen extends React.Component {
	handleMouseMove = (event) => {
		const x = (event.clientX / window.innerWidth - 0.5) * 2;

		const y = (event.clientY / window.innerHeight - 0.5) * 2;

		document.documentElement.style.setProperty('--mouse-x', `${x}px`);

		document.documentElement.style.setProperty('--mouse-y', `${y}px`);
	};

	componentDidMount() {
		window.addEventListener('mousemove', this.handleMouseMove);
	}

	componentWillUnmount() {
		window.removeEventListener('mousemove', this.handleMouseMove);
	}

	render() {
		return (
			<div className="join-screen">
				{/* Stars */}
				<div className="stars"></div>
				<div className="stars stars-two"></div>

				{/* Moon */}
				<div className="moon-wrapper">
					<div className="moon"></div>
				</div>

				{/* Moving clouds */}
				<div className="cloud cloud-one"></div>
				<div className="cloud cloud-two"></div>
				<div className="cloud cloud-three"></div>

				{/* Main content */}
				<div className="join-content">
					<h1>Whiteboard</h1>

					<p className="subtitle">Draw together. Create together.</p>

					<div className="join-card">
						<p className="welcome-text">Welcome</p>

						<h2>What's your name?</h2>

						<input
							type="text"
							placeholder="Enter your name"
							value={this.props.username}
							onChange={this.props.onUsernameChange}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									this.props.onJoin();
								}
							}}
							autoFocus
						/>

						<button onClick={this.props.onJoin}>
							Enter Room
							<span>→</span>
						</button>

						<div className="room-label">
							Room
							<strong>{this.props.roomId}</strong>
						</div>
					</div>
				</div>

				<div className="join-footer">
					Real-time collaborative workspace
				</div>
			</div>
		);
	}
}

export default JoinScreen;
