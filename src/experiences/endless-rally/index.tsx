import React from 'react';
import {ListeningToy} from '../shared/ListeningToy';
import {rallyConfig} from './config';

export default function EndlessRally({onClose}:{onClose:()=>void}) {
  return <ListeningToy config={rallyConfig} onClose={onClose} />;
}
