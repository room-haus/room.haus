import React from 'react';
import styled from 'styled-components';
import addToMailchimp from 'gatsby-plugin-mailchimp';

const EmailInput = styled.input`
  display: inline-block;
  margin-left: 0.2em;
  width: 100%;
  height: 1em;
  outline: none;
  border: 1px solid black;
  background-color: transparent;
`;

const SubmitButton = styled.button`
  right: 1em;
  top: 0.65em;
  position: absolute;
  height: 2em;
  width: 10em;
  border: 2px solid black;
  vertical-align: middle;
  font-size: 0.3em;

  > span {
    vertical-align: middle;
  }
`;

class EmailForm extends React.Component {
  state = {
    email: '',
  };

  handleSubmit = (event) => {
    event.preventDefault();
    addToMailchimp(this.state.email).then(() => {
      this.setState({
        email: '',
      });
    });
  };

  updateEmail = (event) => {
    this.setState({email: event.target.value});
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <span>Email</span>
        <EmailInput
          type="email"
          value={this.state.email}
          onChange={this.updateEmail}
        />
        <SubmitButton type="submit" onClick={this.handleSubmit}>
          <span>Sign-Up Now</span>
        </SubmitButton>
      </form>
    );
  }
}

export default EmailForm;
