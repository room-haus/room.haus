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
  grid-template-columns: 1fr 4fr 1fr;
  grid-template-rows: minmax(40px, 5vh);
  align-items: center;
  padding: 0 10px;
`;

export const HeaderItem = styled.div`
  width: 100%;
  grid-area: ${({position}) => position || 'middle'};
  justify-self: ${getJustifySelf};
`;
