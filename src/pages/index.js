import React from 'react';
import {BrowserRouter, Route, Switch, Redirect} from 'react-router-dom';
import AudioSourceContext from 'src/audio/AudioSourceContext';
import ContentMetaContext from 'src/components/SceneViewer/ContentMetaContext';
import SceneView from 'src/components/SceneViewer';

export default () => (
  <AudioSourceContext>
    <ContentMetaContext>
      <BrowserRouter>
        <Switch>
          <Route path="/mixes/" component={SceneView} />
          <Route path="/releases/" component={SceneView} />
          <Route path="*" render={() => <Redirect to="/mixes/" />} />
        </Switch>
      </BrowserRouter>
    </ContentMetaContext>
  </AudioSourceContext>
);
