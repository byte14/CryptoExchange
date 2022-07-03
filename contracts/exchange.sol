//SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./token.sol";

contract Exchange {
    address public feeAccount;
    uint public feePercent;
    address ETHER = address(0);
    uint256 public orderCount;

    mapping(address => mapping(address => uint256)) public tokens;
    mapping(uint256 => _Order) public orders;
    mapping(uint256 => bool) public cancelledOrder;
    mapping(uint256 => bool) public filledOrder;

    struct _Order {
        uint256 id;
        address user;
        address tokenBuy;
        uint256 amountBuy;
        address tokenSell;
        uint256 amountSell;
        uint256 timestamp;
    }

    event Deposit(address token, address user, uint256 amount, uint256 balance);

    event Withdraw(
        address token,
        address user,
        uint256 amount,
        uint256 balance
    );

    event Order(
        uint256 id,
        address user,
        address tokenBuy,
        uint256 amountBuy,
        address tokenSell,
        uint256 amountSell,
        uint256 timestamp
    );

    event Cancel(
        uint256 id,
        address user,
        address tokenBuy,
        uint256 amountBuy,
        address tokenSell,
        uint256 amountSell,
        uint256 timestamp
    );

    event Trade(
        uint256 id,
        address user,
        address tokenBuy,
        uint256 amountBuy,
        address tokenSell,
        uint256 amountSell,
        address fillUser,
        uint256 timestamp
    );

    constructor(address _feeAccount, uint _feePercent) {
        feeAccount = _feeAccount;
        feePercent = _feePercent;
    }

    function depositEther() public payable {
        tokens[ETHER][msg.sender] += msg.value;
        emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]);
    }

    function withdrawEther(uint256 _amount) public {
        require(tokens[ETHER][msg.sender] >= _amount, "Not enough ETHER");
        tokens[ETHER][msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]);
    }

    function depositToken(address _token, uint256 _amount) public {
        require(_token != ETHER, "Cannot deposit ETHER");
        require(Token(_token).transferFrom(msg.sender, address(this), _amount));
        tokens[_token][msg.sender] += _amount;
        emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function withdrawToken(address _token, uint256 _amount) public {
        require(_token != ETHER, "Cannot withdraw ETHER");
        require(tokens[_token][msg.sender] >= _amount, "Not enough token");
        require(Token(_token).transfer(msg.sender, _amount));
        tokens[_token][msg.sender] -= _amount;
        emit Withdraw(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function balanceOf(address _token, address _user)
        public
        view
        returns (uint256)
    {
        return tokens[_token][_user];
    }

    function makeOrder(
        address _tokenBuy,
        uint256 _amountBuy,
        address _tokenSell,
        uint256 _amountSell
    ) public {
        // require(tokens[_tokenSell][msg.sender] >= _amountSell);
        orderCount += 1;
        orders[orderCount] = _Order(
            orderCount,
            msg.sender,
            _tokenBuy,
            _amountBuy,
            _tokenSell,
            _amountSell,
            block.timestamp
        );
        emit Order(
            orderCount,
            msg.sender,
            _tokenBuy,
            _amountBuy,
            _tokenSell,
            _amountSell,
            block.timestamp
        );
    }

    function cancelOrder(uint256 _id) public {
        _Order storage _order = orders[_id];
        require(msg.sender == _order.user, "Order is not yours");
        require(_id == _order.id, "Order does not exist");
        cancelledOrder[_id] = true;
        emit Cancel(
            _order.id,
            _order.user,
            _order.tokenBuy,
            _order.amountBuy,
            _order.tokenSell,
            _order.amountSell,
            block.timestamp
        );
    }

    function fillOrder(uint256 _id) public {
        require(_id > 0 && _id <= orderCount, "Order does not exist");
        require(
            !filledOrder[_id] && !cancelledOrder[_id],
            "Order is already filled or cancelled"
        );
        _Order storage _order = orders[_id];
        _trade(
            _order.id,
            _order.user,
            _order.tokenBuy,
            _order.amountBuy,
            _order.tokenSell,
            _order.amountSell
        );
        filledOrder[_order.id] = true;
    }

    function _trade(
        uint256 _id,
        address _user,
        address _tokenBuy,
        uint256 _amountBuy,
        address _tokenSell,
        uint256 _amountSell
    ) internal {
        uint256 _feeAmount = (_amountSell * feePercent) / 100;

        tokens[_tokenBuy][msg.sender] -= _amountBuy;
        tokens[_tokenBuy][_user] += _amountBuy;
        tokens[_tokenSell][msg.sender] += _amountSell - _feeAmount;
        tokens[_tokenSell][_user] -= _amountSell;
        tokens[_tokenSell][feeAccount] += _feeAmount;

        emit Trade(
            _id,
            _user,
            _tokenBuy,
            _amountBuy,
            _tokenSell,
            _amountSell,
            msg.sender,
            block.timestamp
        );
    }
}
