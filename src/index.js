import React from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import ReactDOM from 'react-dom';
import Mixes from './pages/mixes';
import './styles/globalStyles';

ReactDOM.render(
  <Router>
    <Switch>
      <Route path="/" component={Mixes} />
    </Switch>
  </Router>,
  document.getElementById('root'),
);
