import React from 'react';
import {BrowserRouter as Router, Route, Switch, Redirect} from 'react-router-dom';
import ReactDOM from 'react-dom';
import Mixes from './pages/mixes';
import './styles/globalStyles';

ReactDOM.render(
  <Router>
    <Switch>
      <Route path="/mixes/" component={Mixes} />
      <Route path="/" render={() => <Redirect from="/" to="/mixes/" />} />
    </Switch>
  </Router>,
  document.getElementById('root'),
);
