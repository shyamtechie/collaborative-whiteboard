import React, { Component } from 'react';

import './JoinScreen.css';

class JoinScreen extends Component {
  constructor(props) {
    super(props);

    this.state = {
      username: '',
    };
  }

  handleChange = (event) => {
    this.setState({
      username: event.target.value,
    });
  };

  handleJoin = () => {
    var username = this.state.username.trim();

    if (!username) {
      return;
    }

    if (this.props.onJoin) {
      this.props.onJoin(username);
    }
  };

  handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      this.handleJoin();
    }
  };

  render() {
    var roomId = this.props.roomId || 'room1';

    return (
      <div className="welcome-page">
        {/* ==============================
                    STARS
                ============================== */}

        <div className="stars">
          <span className="star star-1"></span>
          <span className="star star-2"></span>
          <span className="star star-3"></span>
          <span className="star star-4"></span>
          <span className="star star-5"></span>
          <span className="star star-6"></span>
          <span className="star star-7"></span>
          <span className="star star-8"></span>
          <span className="star star-9"></span>
          <span className="star star-10"></span>
          <span className="star star-11"></span>
          <span className="star star-12"></span>
          <span className="star star-13"></span>
          <span className="star star-14"></span>
          <span className="star star-15"></span>
          <span className="star star-16"></span>
          <span className="star star-17"></span>
          <span className="star star-18"></span>
          <span className="star star-19"></span>
          <span className="star star-20"></span>
          <span className="star star-21"></span>
          <span className="star star-22"></span>
          <span className="star star-23"></span>
          <span className="star star-24"></span>
          <span className="star star-25"></span>
          <span className="star star-26"></span>
          <span className="star star-27"></span>
          <span className="star star-28"></span>
          <span className="star star-29"></span>
          <span className="star star-30"></span>
        </div>

        {/* ==============================
                    REALISTIC CLOUD LAYERS
                ============================== */}

        <div className="cloud-field">
          <div className="real-cloud cloud-left">
            <span className="cloud-part cloud-part-1"></span>
            <span className="cloud-part cloud-part-2"></span>
            <span className="cloud-part cloud-part-3"></span>
            <span className="cloud-part cloud-part-4"></span>
            <span className="cloud-part cloud-part-5"></span>
          </div>

          <div className="real-cloud cloud-right">
            <span className="cloud-part cloud-part-1"></span>
            <span className="cloud-part cloud-part-2"></span>
            <span className="cloud-part cloud-part-3"></span>
            <span className="cloud-part cloud-part-4"></span>
            <span className="cloud-part cloud-part-5"></span>
          </div>

          <div className="real-cloud cloud-background">
            <span className="cloud-part cloud-part-1"></span>
            <span className="cloud-part cloud-part-2"></span>
            <span className="cloud-part cloud-part-3"></span>
            <span className="cloud-part cloud-part-4"></span>
          </div>
        </div>

        {/* ==============================
                    MOON
                ============================== */}

        <div className="welcome-moon">
          <div className="moon-crater crater-one"></div>

          <div className="moon-crater crater-two"></div>

          <div className="moon-crater crater-three"></div>

          <div className="moon-crater crater-four"></div>
        </div>

        {/* ==============================
                    CONTENT
                ============================== */}

        <main className="welcome-content">
          <div className="welcome-title">
            <h1>Whiteboard</h1>

            <p>Draw together. Create together.</p>
          </div>

          <div className="welcome-card">
            <div className="welcome-label">WELCOME</div>

            <h2>What's your name?</h2>

            <input
              type="text"
              value={this.state.username}
              placeholder="Enter your name"
              maxLength="30"
              autoFocus
              onChange={this.handleChange}
              onKeyDown={this.handleKeyDown}
            />

            <button
              type="button"
              disabled={!this.state.username.trim()}
              onClick={this.handleJoin}
            >
              Enter Room
              <span className="arrow">→</span>
            </button>

            <div className="room-display">
              Room <strong>{roomId}</strong>
            </div>
          </div>
        </main>

        {/* ==============================
                    FOOTER
                ============================== */}

        <footer className="welcome-footer">
          Real-time collaborative workspace
        </footer>
      </div>
    );
  }
}

export default JoinScreen;
