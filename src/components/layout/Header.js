import styled from 'styled-components';

const getJustifySelf = ({position = 'middle'}) => {
  const mapping = {
    left: 'start',
    middle: 'center',
    right: 'end',
  };
  return mapping[position];
};

export const Header = styled.div`
  background: #f5f6f6;
  border-bottom: 1px solid gray;

  display: grid;
  grid-template-areas: 'left middle right';
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 7vh;
  align-items: center;
  padding: 0 10px;
`;

export const HeaderItem = styled.div`
  grid-area: ${({position}) => position || 'middle'};
  justify-self: ${getJustifySelf};
`;
